import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { conversations, messages, candidates } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ChatThread } from "@/components/chat/ChatThread";
import { CallButton } from "@/components/voice/CallButton";

/** Strip tool-call JSON blobs — only return the visible text, or null to skip the turn. */
function visibleContent(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { tool_calls?: unknown; text?: string | null };
    if (parsed.tool_calls !== undefined) return parsed.text?.trim() || null;
  } catch {
    // not JSON
  }
  return content;
}

export default async function RajChatPage() {
  const userId = await requireSession();

  // Load or detect existing conversation
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.agent, "raj"),
        eq(conversations.isInterviewSession, false)
      )
    )
    .orderBy(conversations.createdAt)
    .limit(1);

  // Load message history if conversation exists
  const history = conversation
    ? await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.createdAt))
    : [];

  // Check if this is a new user (no profile data)
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  const profile = candidate
    ? (JSON.parse(candidate.profile) as Record<string, unknown>)
    : {};

  // Build clean message list — skip tool turns and strip tool_call JSON blobs
  const initialMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .flatMap((m) => {
      const content = visibleContent(m.content);
      if (!content) return [];
      return [{ id: m.id, role: m.role as "user" | "assistant", content }];
    });

  const isNewUser = Object.keys(profile).length === 0 && initialMessages.length === 0;

  if (isNewUser) {
    initialMessages.push({
      id: "intro",
      role: "assistant",
      content:
        `Hi! I'm Raj — I'm here to find you the right job, not just any job. ` +
        `I'll get to know you first, then surface roles that actually fit. ` +
        `\n\nTo start: what do you do, and what are you looking for next?`,
    });
  } else if (!isNewUser && initialMessages.length === 0) {
    initialMessages.push({
      id: "return",
      role: "assistant",
      content: `Welcome back! Want to keep exploring jobs, or is there something new I can help with?`,
    });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Call Raj button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
        <p className="text-sm font-semibold text-gray-900">Raj</p>
        <CallButton agent="raj" agentName="Raj" />
      </div>
      <ChatThread
        agent="raj"
        initialMessages={initialMessages}
        conversationId={conversation?.id}
      />
    </div>
  );
}
