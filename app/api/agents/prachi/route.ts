import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages, employers, roles } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import {
  PRACHI_SYSTEM_PROMPT,
  PRACHI_TOOLS,
  createPrachiClient,
} from "@/lib/agents/prachi";
import {
  createRole,
  updateRole,
  findCandidates,
  recordEmployerInterest,
  getEmployerRoles,
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userType = (session.user as { type?: string }).type;

    if (userType !== "employer") {
      return NextResponse.json(
        { error: "Only employers can talk to Prachi" },
        { status: 403 }
      );
    }

    const { message, conversationId } = (await req.json()) as {
      message: string;
      conversationId?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Get or create the main Prachi conversation for this user
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
        .values({ userId, agent: "prachi" })
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

    // Inject employer context into system prompt
    const [employer] = await db
      .select()
      .from(employers)
      .where(eq(employers.userId, userId))
      .limit(1);

    const employerRoles = employer
      ? await db
          .select({ id: roles.id, title: roles.title })
          .from(roles)
          .where(and(eq(roles.employerId, employer.id), eq(roles.isActive, true)))
      : [];

    const employerContext = employer
      ? `\n\nEmployer: ${employer.companyName}. Active roles: ${
          employerRoles.length > 0
            ? employerRoles.map((r) => `${r.title} (id: ${r.id})`).join(", ")
            : "none yet"
        }.`
      : "\n\nNew employer — no company profile or roles yet.";

    // ─── Server-side agentic loop ─────────────────────────────────────────────
    const client = createPrachiClient();
    let toolCallCount = 0;
    let finalResponse = "";

    while (toolCallCount < MAX_TOOL_CALLS) {
      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [
          { role: "system", content: PRACHI_SYSTEM_PROMPT + employerContext },
          ...groqMessages,
        ],
        tools: PRACHI_TOOLS,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      if (!choice) break;

      if (choice.finish_reason === "stop") {
        finalResponse = choice.message.content ?? "";
        break;
      }

      if (choice.finish_reason === "tool_calls") {
        const toolCalls = (choice.message.tool_calls ?? []).filter(
          (tc): tc is FunctionToolCall => tc.type === "function"
        );

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
          const result = await executePrachiTool(toolCall.function.name, args, userId);

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

      break;
    }

    if (toolCallCount >= MAX_TOOL_CALLS) {
      finalResponse =
        "I'm running into some complexity here. Could you clarify what you'd like me to do?";
    }

    if (!finalResponse) {
      finalResponse = "I'm here — how can I help with your hiring?";
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

async function executePrachiTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  switch (name) {
    case "create_role":
      return createRole(userId, {
        title: args.title as string,
        description: args.description as string | undefined,
        requirements: args.requirements,
      });

    case "update_role":
      return updateRole(userId, args.role_id as string, {
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        requirements: args.requirements,
      });

    case "get_employer_roles":
      return getEmployerRoles(userId);

    case "find_candidates":
      return findCandidates(
        userId,
        args.role_id as string,
        (args.limit as number) ?? 10
      );

    case "record_employer_interest":
      return recordEmployerInterest(
        userId,
        args.role_id as string,
        args.candidate_id as string
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
        // Plain text assistant message
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
