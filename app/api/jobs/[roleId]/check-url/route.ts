import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;

  const [role] = await db
    .select({ applyUrl: roles.applyUrl })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  if (!role?.applyUrl) {
    // No URL on record — assume alive rather than incorrectly blocking the user
    return NextResponse.json({ alive: true });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(role.applyUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Some servers reject bot-less HEAD requests
        "User-Agent": "Mozilla/5.0 (compatible; jobcheck/1.0)",
      },
    });
    clearTimeout(timeout);

    const dead = res.status === 404;

    if (dead) {
      // Mark inactive so it never appears again
      await db
        .update(roles)
        .set({ isActive: false })
        .where(eq(roles.id, roleId));
    }

    return NextResponse.json({ alive: !dead, status: res.status });
  } catch {
    // Timeout or network error — assume alive to avoid false negatives
    return NextResponse.json({ alive: true });
  }
}
