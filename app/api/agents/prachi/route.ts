import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, ensureUserExists } from "@/lib/session";
import { db } from "@/lib/db";
import { conversations, messages, roles, employers } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import {
  PRACHI_SYSTEM_PROMPT,
  PRACHI_TOOLS,
  createPrachiClient,
} from "@/lib/agents/prachi";
import {
  getJobDetails,
  getCandidateProfile,
  analyzeFit,
} from "@/lib/tools/prachi-tools";
import type OpenAI from "openai";

const MAX_TOOL_CALLS = 10;

type GroqMessage = OpenAI.Chat.ChatCompletionMessageParam;

type FunctionToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }
    await ensureUserExists(userId);

    const { message, conversationId, roleId } = (await req.json()) as {
      message: string;
      conversationId?: string;
      roleId?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Get or create Prachi conversation — scoped to roleId if provided
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
        .values({
          userId,
          agent: "prachi",
          roleId: roleId ?? null,
        })
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

    const groqMessages: GroqMessage[] = buildGroqMessages(history);

    // Save incoming user message
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: message,
    });
    groqMessages.push({ role: "user", content: message });

    // Build job context for system prompt if roleId is set
    let jobContext = "";
    const contextRoleId = roleId ?? conversation.roleId;
    if (contextRoleId) {
      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, contextRoleId))
        .limit(1);

      if (role) {
        let companyName = role.companyName;
        if (!companyName && role.employerId) {
          const [employer] = await db
            .select({ companyName: employers.companyName })
            .from(employers)
            .where(eq(employers.id, role.employerId))
            .limit(1);
          companyName = employer?.companyName ?? null;
        }
        jobContext = `\n\nContext: This conversation is about the "${role.title}" role at ${companyName ?? "Unknown Company"} (role_id: ${role.id}). The seeker is preparing to apply for or analyze this specific job. Use get_job_details and get_candidate_profile to give tailored advice.`;
      }
    }

    // ─── Server-side agentic loop ─────────────────────────────────────────────
    const client = createPrachiClient();
    let toolCallCount = 0;
    let finalResponse = "";

    while (toolCallCount < MAX_TOOL_CALLS) {
      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [
          { role: "system", content: PRACHI_SYSTEM_PROMPT + jobContext },
          ...groqMessages,
        ],
        tools: PRACHI_TOOLS,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      if (!choice) break;

      // Check tool_calls first — some Groq/llama versions set finish_reason="stop"
      // while still including tool_calls (quirk of certain model releases).
      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (tc): tc is FunctionToolCall => tc.type === "function"
      );

      if (toolCalls.length === 0) {
        finalResponse = stripToolCallMarkup(choice.message.content ?? "");
        break;
      }

      if (toolCalls.length > 0) {
        groqMessages.push({
          role: "assistant",
          content: choice.message.content,
          tool_calls: toolCalls,
        });

        await db.insert(messages).values({
          conversationId: conversation.id,
          role: "assistant",
          content: JSON.stringify({
            tool_calls: toolCalls,
            text: choice.message.content,
          }),
        });

        for (const toolCall of toolCalls) {
          toolCallCount++;
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const result = await executePrachiTool(
            toolCall.function.name,
            args,
            userId,
            contextRoleId
          );

          await db.insert(messages).values({
            conversationId: conversation.id,
            role: "tool",
            content: JSON.stringify(result),
            toolName: toolCall.function.name,
            toolUseId: toolCall.id,
          });

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
        "I'm gathering a lot of information here. Could you focus your question so I can give you sharper advice?";
    }

    if (!finalResponse) {
      finalResponse = "I'm here to help you land this role — what would you like to dig into?";
    }

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
    console.error("Prachi agent error:", err);
    return NextResponse.json(
      {
        error:
          "Prachi is having trouble connecting right now. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}

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

async function executePrachiTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  contextRoleId?: string | null
): Promise<unknown> {
  switch (name) {
    case "get_job_details":
      return getJobDetails((args.role_id as string) ?? contextRoleId ?? "");

    case "get_candidate_profile":
      return getCandidateProfile(userId);

    case "analyze_fit":
      return analyzeFit(
        userId,
        (args.role_id as string) ?? contextRoleId ?? ""
      );

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

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
        // Plain text
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
