/**
 * Cookie-based session — no auth required.
 * The middleware sets a `raj-session` cookie containing a UUID on every first visit.
 * This module reads that cookie and lazily creates the user + candidate rows in the DB.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Read the session cookie. Returns the userId string or null. */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("raj-session")?.value ?? null;
}

/**
 * Ensure a user + candidate row exists for this userId.
 * Safe to call repeatedly — exits early if the row already exists.
 */
export async function ensureUserExists(userId: string): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length === 0) {
    // Email is required by the legacy schema — use an anonymous placeholder.
    // Use onConflictDoNothing to handle concurrent requests creating the same user.
    await db.insert(users).values({
      id: userId,
      email: `${userId}@anon.local`,
      type: "seeker",
    }).onConflictDoNothing();
    await db.insert(candidates).values({
      userId,
      profile: "{}",
    }).onConflictDoNothing();
  }
}

/**
 * Returns the userId for the current request, auto-creating DB rows if needed.
 * Redirects to "/" if the cookie is missing (shouldn't happen if middleware is running).
 */
export async function requireSession(): Promise<string> {
  const userId = await getSessionId();
  if (!userId) redirect("/");
  await ensureUserExists(userId);
  return userId;
}

/**
 * Same as requireSession but does NOT create DB rows.
 * Use in API routes where you want to verify the session without side effects.
 */
export async function getSessionUserId(): Promise<string | null> {
  return getSessionId();
}
