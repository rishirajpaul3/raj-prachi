import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  notifications,
  matches,
  roles,
  employers,
} from "@/lib/db/schema";
import { eq, isNull, and, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function SeekerMatchesPage() {
  const userId = await requireSession();

  // Get all notifications for this user, ordered newest first
  const userNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));

  // Mark all unread as read
  if (userNotifications.some((n) => !n.readAt)) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  if (userNotifications.length === 0) {
    return emptyState();
  }

  // Batch-fetch all matches in one query
  const matchIds = userNotifications.map((n) => n.matchId);
  const matchRows = await db.select().from(matches).where(inArray(matches.id, matchIds));
  const matchMap = new Map(matchRows.map((m) => [m.id, m]));

  // Batch-fetch all roles in one query
  const roleIds = [...new Set(matchRows.map((m) => m.roleId))];
  const roleRows = roleIds.length > 0
    ? await db.select().from(roles).where(inArray(roles.id, roleIds))
    : [];
  const roleMap = new Map(roleRows.map((r) => [r.id, r]));

  // Batch-fetch employer names
  const missingEmployerIds = [
    ...new Set(
      roleRows
        .filter((r) => !r.companyName && r.employerId)
        .map((r) => r.employerId as string)
    ),
  ];
  const employerMap = new Map<string, string>();
  if (missingEmployerIds.length > 0) {
    const employerRows = await db
      .select({ id: employers.id, companyName: employers.companyName })
      .from(employers)
      .where(inArray(employers.id, missingEmployerIds));
    for (const e of employerRows) employerMap.set(e.id, e.companyName);
  }

  const validMatches = userNotifications
    .map((notif) => {
      const match = matchMap.get(notif.matchId);
      if (!match) return null;
      const role = roleMap.get(match.roleId);
      const companyName =
        role?.companyName ??
        (role?.employerId ? employerMap.get(role.employerId) : undefined) ??
        "Unknown Company";
      return {
        notificationId: notif.id,
        matchId: match.id,
        roleTitle: role?.title ?? "Unknown Role",
        companyName,
        introText: match.introText ?? notif.text,
        matchedAt: match.matchedAt,
        isNew: !notif.readAt,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (validMatches.length === 0) {
    return emptyState();
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

function emptyState() {
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
