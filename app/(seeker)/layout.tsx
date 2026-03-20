import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/layout/TabBar";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { SeekerIcons } from "@/components/layout/SeekerIcons";

export default async function SeekerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userType = (session.user as { type?: string }).type;
  if (userType !== "seeker") redirect("/employer/chat");

  // Unread notification count for badge
  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
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

      {/* Page content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      <SeekerIcons unreadCount={unreadCount} />
    </div>
  );
}
