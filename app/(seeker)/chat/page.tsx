import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { conversations, messages, candidates } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ChatThread } from "@/components/chat/ChatThread";

export default async function RajChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

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

  const profile = candidate ? JSON.parse(candidate.profile) as Record<string, unknown> : {};
  const isNewUser = Object.keys(profile).length === 0 && history.length === 0;

  // Opening message for new users — Raj speaks first
  const initialMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (isNewUser && initialMessages.length === 0) {
    initialMessages.push({
      id: "intro",
      role: "assistant",
      content:
        `Hi! I'm Raj — I'm here to find you the right job, not just any job. ` +
        `I'll get to know you first, then surface roles that actually fit. ` +
        `\n\nTo start: what do you do, and what are you looking for next?`,
    });
  } else if (!isNewUser && initialMessages.length === 0) {
    // Returning user, no messages yet in this session
    const name = session.user.name ?? session.user.email?.split("@")[0] ?? "";
    initialMessages.push({
      id: "return",
      role: "assistant",
      content: `Welcome back${name ? `, ${name}` : ""}! Want to keep exploring jobs, or is there something new I can help with?`,
    });
  }

  return (
    <div className="h-full flex flex-col">
      <ChatThread
        agent="raj"
        initialMessages={initialMessages}
        conversationId={conversation?.id}
      />
    </div>
  );
}
