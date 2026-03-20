import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  notifications,
  matches,
  roles,
  employers,
  candidates,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function SeekerMatchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Get all notifications for this user, ordered newest first
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

  // Enrich with match/role/employer details
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

      const [employer] = role
        ? await db
            .select()
            .from(employers)
            .where(eq(employers.id, role.employerId))
            .limit(1)
        : [null];

      return {
        notificationId: notif.id,
        matchId: match.id,
        roleTitle: role?.title ?? "Unknown Role",
        companyName: employer?.companyName ?? "Unknown Company",
        introText: match.introText ?? notif.text,
        matchedAt: match.matchedAt,
        isNew: !notif.readAt,
      };
    })
  );

  const validMatches = enriched.filter(Boolean) as NonNullable<
    (typeof enriched)[number]
  >[];

  if (validMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
          ✨
        </div>
        <h2 className="font-semibold text-gray-900">No matches yet</h2>
        <p className="text-sm text-gray-500">
          Prachi is looking. The moment a company wants to meet you, you&apos;ll
          see it here.
        </p>
        <p className="text-xs text-gray-400 mt-1">Keep swiping on jobs you like.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-20">
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Your Matches
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
                  <h3 className="font-semibold text-gray-900">{m.roleTitle}</h3>
                  <p className="text-sm text-amber-700">{m.companyName}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                  🎉
                </div>
              </div>

              <div className="mt-3 bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-medium text-amber-600 mb-1">
                  From Prachi:
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
