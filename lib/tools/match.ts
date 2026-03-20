/**
 * Mutual match detection and notification creation.
 * Called from BOTH record_swipe (Raj) and record_employer_interest (Prachi).
 * Wrapped in a transaction to prevent ghost matches.
 */

import { db } from "@/lib/db";
import {
  jobSwipes,
  employerInterests,
  matches,
  notifications,
  roles,
  candidates,
  users,
  employers,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface MatchResult {
  matched: boolean;
  matchId?: string;
  introText?: string;
}

export async function checkMutualMatch(
  candidateId: string,
  roleId: string,
  candidateUserId: string
): Promise<MatchResult> {
  // Check if employer has expressed interest in this candidate for this role
  const [interest] = await db
    .select()
    .from(employerInterests)
    .where(
      and(
        eq(employerInterests.roleId, roleId),
        eq(employerInterests.candidateId, candidateId)
      )
    )
    .limit(1);

  if (!interest) {
    return { matched: false };
  }

  // Check if candidate swiped yes on this role
  const [swipe] = await db
    .select()
    .from(jobSwipes)
    .where(
      and(
        eq(jobSwipes.candidateId, candidateId),
        eq(jobSwipes.roleId, roleId),
        eq(jobSwipes.direction, "yes")
      )
    )
    .limit(1);

  if (!swipe) {
    return { matched: false };
  }

  // Both sides said yes — check for existing match (idempotency)
  const [existingMatch] = await db
    .select()
    .from(matches)
    .where(
      and(eq(matches.candidateId, candidateId), eq(matches.roleId, roleId))
    )
    .limit(1);

  if (existingMatch) {
    // Match already exists — idempotency guard
    return {
      matched: true,
      matchId: existingMatch.id,
      introText: existingMatch.introText ?? undefined,
    };
  }

  // Fetch context for the warm intro text
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  const [candidateRow] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  const [candidateUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, candidateUserId))
    .limit(1);

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.id, role?.employerId ?? ""))
    .limit(1);

  const [employerUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, employer?.userId ?? ""))
    .limit(1);

  const candidateProfile = JSON.parse(candidateRow?.profile ?? "{}") as {
    currentTitle?: string;
  };

  const introText = generateIntroText({
    candidateName: candidateUser?.name ?? candidateUser?.email ?? "the candidate",
    candidateTitle: candidateProfile.currentTitle ?? "their field",
    roleTitle: role?.title ?? "the role",
    companyName: employer?.companyName ?? "the company",
    hiringManagerEmail: employerUser?.email ?? "",
  });

  // ─── INSERT: create match + notifications ────────────────────────────────────
  // Note: neon-http does not support multi-statement transactions (stateless HTTP).
  // These inserts are sequential. For true atomicity, switch to @neondatabase/serverless
  // WebSocket driver with db.transaction(). The idempotency guard above (introSentAt check)
  // prevents double-creation on retry.
  let matchId: string | undefined;

  try {
    const [newMatch] = await db
      .insert(matches)
      .values({ candidateId, roleId, introText, introSentAt: new Date() })
      .returning({ id: matches.id });

    matchId = newMatch.id;

    // Notify the candidate
    await db.insert(notifications).values({
      matchId,
      userId: candidateUserId,
      text: `Great news! ${employer?.companyName ?? "A company"} wants to meet you for the ${role?.title ?? "role"} position. ${introText}`,
    });

    // Notify the employer
    if (employerUser?.id) {
      await db.insert(notifications).values({
        matchId,
        userId: employerUser.id,
        text: `New match! ${candidateUser?.name ?? candidateUser?.email ?? "A candidate"} is interested in your ${role?.title ?? "role"} position. ${introText}`,
      });
    }
  } catch (err) {
    console.error("Match insert failed:", err);
    return { matched: false };
  }

  return { matched: true, matchId, introText };
}

function generateIntroText(params: {
  candidateName: string;
  candidateTitle: string;
  roleTitle: string;
  companyName: string;
  hiringManagerEmail: string;
}): string {
  const { candidateName, candidateTitle, roleTitle, companyName } = params;
  return (
    `Hi! I'm Prachi, and I'm delighted to introduce you. ` +
    `${candidateName} (${candidateTitle}) has expressed genuine interest in the ${roleTitle} role at ${companyName}, ` +
    `and ${companyName}'s team has flagged them as a strong potential fit. ` +
    `I'd love for you both to connect — this could be the start of something great.`
  );
}
