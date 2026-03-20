import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, ensureUserExists } from "@/lib/session";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CandidateProfileSchema } from "@/lib/types";

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
  await ensureUserExists(userId);

  const body = (await req.json()) as unknown;
  const parsed = CandidateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }

  await db
    .update(candidates)
    .set({ profile: JSON.stringify(parsed.data), updatedAt: new Date() })
    .where(eq(candidates.userId, userId));

  return NextResponse.json({ ok: true });
}
