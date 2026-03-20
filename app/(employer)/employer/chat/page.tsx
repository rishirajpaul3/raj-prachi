import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { conversations, messages, employers } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ChatThread } from "@/components/chat/ChatThread";

export default async function PrachiChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.agent, "prachi")
      )
    )
    .orderBy(conversations.createdAt)
    .limit(1);

  const history = conversation
    ? await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(asc(messages.createdAt))
    : [];

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  const isNewEmployer = !employer;

  const initialMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (initialMessages.length === 0) {
    if (isNewEmployer) {
      initialMessages.push({
        id: "intro",
        role: "assistant",
        content:
          `Hi, I'm Prachi — your talent partner. I'll help you define the role, ` +
          `find the right people, and make warm introductions when there's a mutual fit.\n\n` +
          `To start: what role are you hiring for, and what's the company?`,
      });
    } else {
      initialMessages.push({
        id: "return",
        role: "assistant",
        content: `Welcome back. Want to see candidates for an open role, or is there something else I can help with?`,
      });
    }
  }

  return (
    <div className="h-full flex flex-col">
      <ChatThread
        agent="prachi"
        initialMessages={initialMessages}
        conversationId={conversation?.id}
      />
    </div>
  );
}
