import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { EmployerIcons } from "@/components/layout/EmployerIcons";

export default async function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userType = (session.user as { type?: string }).type;
  if (userType !== "employer") redirect("/chat");

  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    );

  return (
    <div className="flex flex-col h-screen bg-[#F0F4F8]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-blue-100">
        <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-sm font-bold">
          P
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Prachi</p>
          <p className="text-xs text-[#1E3A5F]">Your talent partner</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">{children}</div>

      <EmployerIcons unreadCount={unread.length} />
    </div>
  );
}
