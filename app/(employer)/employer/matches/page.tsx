import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  notifications,
  matches,
  roles,
  candidates,
  users,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EmployerMatchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const userNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));

  // Mark all as read
  if (userNotifications.some((n) => !n.readAt)) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId)));
  }

  const enriched = await Promise.all(
    userNotifications.map(async (notif) => {
      const [match] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, notif.matchId))
        .limit(1);

      if (!match) return null;

      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, match.roleId))
        .limit(1);

      const [candidate] = await db
        .select()
        .from(candidates)
        .where(eq(candidates.id, match.candidateId))
        .limit(1);

      const [candidateUser] = candidate
        ? await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, candidate.userId))
            .limit(1)
        : [null];

      return {
        notificationId: notif.id,
        matchId: match.id,
        roleTitle: role?.title ?? "Unknown Role",
        candidateName:
          candidateUser?.name ??
          candidateUser?.email?.split("@")[0] ??
          "A candidate",
        introText: match.introText ?? notif.text,
        matchedAt: match.matchedAt,
      };
    })
  );

  const validMatches = enriched.filter(Boolean) as NonNullable<
    (typeof enriched)[number]
  >[];

  if (validMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
          ⏳
        </div>
        <h2 className="font-semibold text-gray-900">No matches yet</h2>
        <p className="text-sm text-gray-500">
          Prachi is looking. When a candidate is interested in your role and
          you&apos;ve expressed interest in them, you&apos;ll see the introduction here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-20">
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Matches
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({validMatches.length})
          </span>
        </h2>

        <div className="flex flex-col gap-3">
          {validMatches.map((m) => (
            <div
              key={m.matchId}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {m.candidateName}
                  </h3>
                  <p className="text-sm text-[#1E3A5F]">{m.roleTitle}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                  ✓
                </div>
              </div>

              <div className="mt-3 bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-medium text-[#1E3A5F] mb-1">
                  Prachi&apos;s introduction:
                </p>
                <p className="text-sm text-gray-700 leading-relaxed italic">
                  &ldquo;{m.introText}&rdquo;
                </p>
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Matched{" "}
                {new Date(m.matchedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
