import { requireSession } from "@/lib/session";
import { TabBar } from "@/components/layout/TabBar";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { SeekerIcons } from "@/components/layout/SeekerIcons";

export default async function SeekerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireSession();

  // Unread notification count for badge
  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );

  const unreadCount = unread.length;

  return (
    <div className="flex flex-col h-screen bg-[#FFF8F0]">
      {/* Agent identity header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-amber-100">
        <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold">
          R
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Raj</p>
          <p className="text-xs text-amber-600">Your career advocate</p>
        </div>
      </header>

      {/* Page content — flex-1 fills space between header and nav spacer */}
      <div className="flex-1 overflow-hidden min-h-0">{children}</div>

      {/* Spacer reserves 64px so content never scrolls behind the fixed TabBar */}
      <div className="h-16 flex-shrink-0" aria-hidden="true" />

      <SeekerIcons unreadCount={unreadCount} />
    </div>
  );
}
