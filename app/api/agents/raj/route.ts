import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, ensureUserExists } from "@/lib/session";
import { db } from "@/lib/db";
import { conversations, messages, candidates } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { RAJ_SYSTEM_PROMPT, RAJ_TOOLS, createRajClient } from "@/lib/agents/raj";
import {
  updateCandidateProfile,
  searchJobs,
  recordSwipe,
  runMockInterview,
  giveInterviewFeedback,
  salaryBenchmark,
} from "@/lib/tools/raj-tools";
import type OpenAI from "openai";

const MAX_TOOL_CALLS = 10;
const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

type GroqMessage = OpenAI.Chat.ChatCompletionMessageParam;

// OpenAI v6 union-types tool calls; narrow to function calls only
type FunctionToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured");
      return NextResponse.json(
        { error: "Raj is not available right now. (Configuration error)" },
        { status: 503 }
      );
    }

    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }
    await ensureUserExists(userId);

    const { message, conversationId } = (await req.json()) as {
      message: string;
      conversationId?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Get or create the main Raj conversation for this user
    let conversation;
    if (conversationId) {
      const [found] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId)
          )
        )
        .limit(1);
      conversation = found;
    }

    if (!conversation) {
      const [created] = await db
        .insert(conversations)
        .values({ userId, agent: "raj" })
        .returning();
      conversation = created;
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Failed to get conversation" },
        { status: 500 }
      );
    }

    // Load conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt));

    // Build Groq message array from DB history
    const groqMessages: GroqMessage[] = buildGroqMessages(history);

    // Save the incoming user message
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: message,
    });

    groqMessages.push({ role: "user", content: message });

    // Inject candidate profile context into the system prompt
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.userId, userId))
      .limit(1);

    const profileContext = candidate
      ? `\n\nCandidate profile: ${candidate.profile}`
      : "\n\nThis is a new candidate with no profile yet.";

    // ─── Server-side agentic loop ─────────────────────────────────────────────
    const client = createRajClient();
    let toolCallCount = 0;
    let finalResponse = "";
    let modelIndex = 0;

    while (toolCallCount < MAX_TOOL_CALLS) {
      let response;
      try {
        response = await client.chat.completions.create({
          model: MODELS[modelIndex],
          max_tokens: 1024,
          messages: [
            { role: "system", content: RAJ_SYSTEM_PROMPT + profileContext },
            ...groqMessages,
          ],
          tools: RAJ_TOOLS,
          tool_choice: "auto",
        });
      } catch (apiErr: unknown) {
        // On rate limit, fall back to the next model in the list
        const statusCode = (apiErr as { status?: number })?.status;
        if (statusCode === 429 && modelIndex < MODELS.length - 1) {
          modelIndex++;
          continue;
        }
        throw apiErr;
      }

      const choice = response.choices[0];
      if (!choice) break;

      // Check for tool_calls FIRST — some Groq model versions set finish_reason="stop"
      // while still including tool_calls in the message (llama quirk).
      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (tc): tc is FunctionToolCall => tc.type === "function"
      );

      if (toolCalls.length === 0) {
        // No tool calls → this is the final text response; strip any XML tool-call
        // artifacts that llama occasionally emits as plain text.
        finalResponse = stripToolCallMarkup(choice.message.content ?? "");
        break;
      }

      if (toolCalls.length > 0) {

        // Add assistant message (with tool_calls) to in-memory history
        groqMessages.push({
          role: "assistant",
          content: choice.message.content,
          tool_calls: toolCalls,
        });

        // Persist assistant turn to DB — serialize tool_calls so history can be rebuilt
        await db.insert(messages).values({
          conversationId: conversation.id,
          role: "assistant",
          content: JSON.stringify({
            tool_calls: toolCalls,
            text: choice.message.content,
          }),
        });

        // Execute each tool call and feed results back
        for (const toolCall of toolCalls) {
          toolCallCount++;
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const result = await executeRajTool(toolCall.function.name, args, userId);

          // Persist tool result
          await db.insert(messages).values({
            conversationId: conversation.id,
            role: "tool",
            content: JSON.stringify(result),
            toolName: toolCall.function.name,
            toolUseId: toolCall.id,
          });

          // Add tool result to in-memory history
          groqMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        continue;
      }
    }

    if (toolCallCount >= MAX_TOOL_CALLS) {
      finalResponse =
        "I'm having a bit of trouble completing that request right now. Could you try rephrasing, or let me know what you were looking for?";
    }

    if (!finalResponse) {
      finalResponse = "I'm here — what would you like to explore?";
    }

    // Save final assistant response
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "assistant",
      content: finalResponse,
    });

    return NextResponse.json({
      message: finalResponse,
      conversationId: conversation.id,
    });
  } catch (err) {
    console.error("Raj agent error:", err);
    return NextResponse.json(
      {
        error:
          "Raj is having trouble connecting right now. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}

// ─── Strip XML tool-call markup from LLM text output ─────────────────────────
// Groq/llama models sometimes emit tool calls as plain-text XML alongside or
// instead of the structured API response. Strip these before showing to users.

function stripToolCallMarkup(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, "")
    .replace(/<function\b[^>]*>[\s\S]*?<\/function>/gi, "")
    .replace(/<\/?(tool_call|function_calls|function|invoke|parameter)[^>]*>/gi, "")
    .replace(/```json\s*\{\s*"name"\s*:[\s\S]*?```/gi, "")
    .replace(/\[TOOL_CALLS\][\s\S]*?\[\/TOOL_CALLS\]/gi, "")
    .trim();
}

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

async function executeRajTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  switch (name) {
    case "update_candidate_profile":
      return updateCandidateProfile(userId, args.fields);

    case "search_jobs":
      return searchJobs(
        userId,
        args.filters as Parameters<typeof searchJobs>[1]
      );

    case "record_swipe":
      return recordSwipe(
        userId,
        args.role_id as string,
        args.direction as "yes" | "no",
        args.raj_reason as string | undefined
      );

    case "run_mock_interview":
      return runMockInterview(userId, args.role_id as string);

    case "give_interview_feedback":
      return giveInterviewFeedback(args.conversation_id as string);

    case "salary_benchmark":
      return salaryBenchmark(
        args.role as string,
        args.level as string,
        args.location as string
      );

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// ─── History builder ──────────────────────────────────────────────────────────

function buildGroqMessages(
  dbMessages: Array<{
    role: string;
    content: string;
    toolName: string | null;
    toolUseId: string | null;
  }>
): GroqMessage[] {
  const result: GroqMessage[] = [];

  for (const msg of dbMessages) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      // Tool-call assistant messages are stored as JSON; detect and reconstruct
      try {
        const parsed = JSON.parse(msg.content) as {
          tool_calls?: FunctionToolCall[];
          text?: string | null;
        };
        if (parsed.tool_calls) {
          result.push({
            role: "assistant",
            content: parsed.text ?? null,
            tool_calls: parsed.tool_calls,
          });
          continue;
        }
      } catch {
        // Not JSON — plain text assistant message
      }
      result.push({ role: "assistant", content: msg.content });
    } else if (msg.role === "tool" && msg.toolUseId) {
      result.push({
        role: "tool",
        tool_call_id: msg.toolUseId,
        content: msg.content,
      });
    }
  }

  return result;
}
