import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ChatThread } from "@/components/chat/ChatThread";

export const dynamic = "force-dynamic";

function visibleContent(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { tool_calls?: unknown; text?: string | null };
    if (parsed.tool_calls !== undefined) return parsed.text?.trim() || null;
  } catch {
    // not JSON
  }
  return content;
}

export default async function PrachiPage() {
  const userId = await requireSession();

  // Load existing general Prachi conversation (no roleId)
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

  const initialMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .flatMap((m) => {
      const content = visibleContent(m.content);
      if (!content) return [];
      return [{ id: m.id, role: m.role as "user" | "assistant", content }];
    });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-sm font-bold">
          P
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Prachi</p>
          <p className="text-xs text-blue-600">Hiring intelligence partner</p>
        </div>
      </div>

      <ChatThread
        agent="prachi"
        initialMessages={initialMessages}
        conversationId={conversation?.id}
        placeholder="Ask Prachi about a job, your resume, or application strategy..."
      />
    </div>
  );
}
