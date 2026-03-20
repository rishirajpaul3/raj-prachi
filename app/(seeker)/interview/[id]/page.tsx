import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { conversations, messages, roles } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ChatThread } from "@/components/chat/ChatThread";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InterviewPage({ params }: Props) {
  const { id } = await params;
  const userId = await requireSession();

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.userId, userId),
        eq(conversations.isInterviewSession, true)
      )
    )
    .limit(1);

  if (!conversation) notFound();

  const role = conversation.roleId
    ? await db
        .select()
        .from(roles)
        .where(eq(roles.id, conversation.roleId))
        .limit(1)
        .then((r) => r[0])
    : null;

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt));

  const initialMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (initialMessages.length === 0) {
    initialMessages.push({
      id: "interview-start",
      role: "assistant",
      content:
        `Let's do this. I'll ask you 5 questions for the ${role?.title ?? "role"} — answer as if this were the real interview. ` +
        `I'll give you honest feedback at the end.\n\n**Question 1:** Tell me about yourself and why you're interested in this type of role.`,
    });
  }

  const questionCount = history.filter((m) => m.role === "user").length;
  const totalQuestions = 5;

  return (
    <div className="h-full flex flex-col">
      {/* Interview mode banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-amber-700">
            Mock Interview
            {role && ` · ${role.title}`}
          </span>
          <span className="text-xs text-amber-600">
            {conversation.interviewComplete
              ? "Complete"
              : `Question ${Math.min(questionCount + 1, totalQuestions)} of ${totalQuestions}`}
          </span>
        </div>
        {!conversation.interviewComplete && (
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{
                width: `${(Math.min(questionCount, totalQuestions) / totalQuestions) * 100}%`,
              }}
            />
          </div>
        )}
        {conversation.interviewComplete && (
          <p className="text-xs text-amber-600">
            Interview complete — feedback above
          </p>
        )}
      </div>

      <ChatThread
        agent="raj"
        initialMessages={initialMessages}
        conversationId={conversation.id}
        isInterviewMode
        placeholder="Type your answer..."
      />
    </div>
  );
}
