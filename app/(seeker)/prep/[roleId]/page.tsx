import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { roles, employers, conversations, messages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ChatThread } from "@/components/chat/ChatThread";
import Link from "next/link";
import { redirect } from "next/navigation";

interface PrepPageProps {
  params: Promise<{ roleId: string }>;
}

/** Strip tool-call JSON blobs from message content. */
function visibleContent(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { tool_calls?: unknown; text?: string | null };
    if (parsed.tool_calls !== undefined) return parsed.text?.trim() || null;
  } catch {
    // not JSON
  }
  return content;
}

export default async function PrepPage({ params }: PrepPageProps) {
  const { roleId } = await params;
  const userId = await requireSession();

  // Load the role
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.isActive, true)))
    .limit(1);

  if (!role) redirect("/jobs");

  // Resolve company name
  let companyName = role.companyName;
  if (!companyName && role.employerId) {
    const [employer] = await db
      .select({ companyName: employers.companyName })
      .from(employers)
      .where(eq(employers.id, role.employerId))
      .limit(1);
    companyName = employer?.companyName ?? null;
  }
  const displayCompany = companyName ?? "this company";

  // Find existing Prachi conversation for this role
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.agent, "prachi"),
        eq(conversations.roleId, roleId)
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

  const autoTriggerMessage =
    initialMessages.length === 0
      ? `I'm preparing to apply for the ${role.title} role at ${displayCompany}. Start with a full fit analysis — what are my strengths for this role, what are the gaps I need to address, and how should I tailor my resume?`
      : undefined;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <Link
          href="/jobs"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Back to jobs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Prep with Prachi</p>
          <p className="text-sm font-semibold text-gray-900 truncate">
            {role.title} · {displayCompany}
          </p>
        </div>
      </div>

      <ChatThread
        agent="prachi"
        initialMessages={initialMessages}
        conversationId={conversation?.id}
        roleId={roleId}
        autoTriggerMessage={autoTriggerMessage}
        placeholder={`Ask Prachi about ${role.title}...`}
      />
    </div>
  );
}
