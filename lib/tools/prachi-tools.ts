/**
 * Prachi's tool implementations.
 * These are plain server-side functions — NOT HTTP endpoints.
 * Only the Prachi agent API route calls them, server-side.
 */

import { db } from "@/lib/db";
import {
  candidates,
  employers,
  roles,
  employerInterests,
  jobSwipes,
  users,
} from "@/lib/db/schema";
import {
  RoleRequirementsSchema,
  type ToolResult,
  type ScoredCandidate,
  type CandidateProfile,
  type RoleRequirements,
} from "@/lib/types";
import { eq, and } from "drizzle-orm";
import { checkMutualMatch } from "@/lib/tools/match";

// ─── Tool: create_role ────────────────────────────────────────────────────────

export async function createRole(
  userId: string,
  details: {
    title: string;
    description?: string;
    requirements?: unknown;
  }
): Promise<ToolResult> {
  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  if (!employer) {
    return { success: false, error: "Employer profile not found" };
  }

  if (!details.title) {
    return { success: false, error: "Role title is required" };
  }

  const parsed = details.requirements
    ? RoleRequirementsSchema.safeParse(details.requirements)
    : { success: true, data: {} };

  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid requirements: ${(parsed as { error: { message: string } }).error.message}`,
    };
  }

  const [role] = await db
    .insert(roles)
    .values({
      employerId: employer.id,
      title: details.title,
      description: details.description ?? "",
      requirements: JSON.stringify(parsed.data),
    })
    .returning();

  if (!role) {
    return { success: false, error: "Failed to create role" };
  }

  return {
    success: true,
    data: { roleId: role.id, title: role.title, message: `Role "${role.title}" created successfully.` },
  };
}

// ─── Tool: update_role ────────────────────────────────────────────────────────

export async function updateRole(
  userId: string,
  roleId: string,
  updates: {
    title?: string;
    description?: string;
    requirements?: unknown;
  }
): Promise<ToolResult> {
  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  if (!employer) {
    return { success: false, error: "Employer not found" };
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.employerId, employer.id)))
    .limit(1);

  if (!role) {
    return { success: false, error: "Role not found or not owned by you" };
  }

  const existingReqs = JSON.parse(role.requirements) as RoleRequirements;
  let mergedRequirements = existingReqs;

  if (updates.requirements) {
    const parsed = RoleRequirementsSchema.safeParse(updates.requirements);
    if (!parsed.success) {
      return { success: false, error: `Invalid requirements: ${parsed.error.message}` };
    }
    mergedRequirements = { ...existingReqs, ...parsed.data };
  }

  await db
    .update(roles)
    .set({
      title: updates.title ?? role.title,
      description: updates.description ?? role.description,
      requirements: JSON.stringify(mergedRequirements),
    })
    .where(eq(roles.id, roleId));

  return { success: true, data: { roleId, message: "Role updated." } };
}

// ─── Tool: find_candidates ────────────────────────────────────────────────────

export async function findCandidates(
  userId: string,
  roleId: string,
  limit = 10
): Promise<ToolResult> {
  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  if (!employer) {
    return { success: false, error: "Employer not found" };
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.employerId, employer.id)))
    .limit(1);

  if (!role) {
    return { success: false, error: "Role not found" };
  }

  const requirements = JSON.parse(role.requirements) as RoleRequirements;

  // Get candidates already marked as interested (to exclude from fresh results)
  const alreadyInterested = await db
    .select({ candidateId: employerInterests.candidateId })
    .from(employerInterests)
    .where(eq(employerInterests.roleId, roleId));

  const excludeIds = alreadyInterested.map((i) => i.candidateId);

  // Fetch all active candidates (for learning project scale)
  const allCandidates = await db.select().from(candidates);

  // Score candidates by SQL-based skill matching
  const scored: ScoredCandidate[] = allCandidates
    .filter((c) => !excludeIds.includes(c.id))
    .map((candidate) => {
      const profile = JSON.parse(candidate.profile) as CandidateProfile;
      let score = 0;
      const matchReasons: string[] = [];

      // Skill overlap
      const candidateSkills = (profile.skills ?? []).map((s) => s.toLowerCase());
      const requiredSkills = (requirements.skills ?? []).map((s) => s.toLowerCase());
      const mustHave = (requirements.mustHave ?? []).map((s) => s.toLowerCase());

      const overlap = candidateSkills.filter((s) => requiredSkills.includes(s));
      if (overlap.length > 0) {
        score += overlap.length * 10;
        matchReasons.push(`${overlap.length} matching skill${overlap.length > 1 ? "s" : ""}: ${overlap.slice(0, 3).join(", ")}`);
      }

      // Must-have skills
      const hasMustHave = mustHave.every((s) => candidateSkills.includes(s));
      if (mustHave.length > 0 && hasMustHave) {
        score += 30;
        matchReasons.push("Has all required skills");
      } else if (mustHave.length > 0 && !hasMustHave) {
        score -= 20; // penalize missing must-haves
      }

      // Experience match
      if (requirements.minYearsExperience !== undefined && profile.yearsOfExperience !== undefined) {
        if (profile.yearsOfExperience >= requirements.minYearsExperience) {
          score += 15;
          matchReasons.push(`${profile.yearsOfExperience} years experience`);
        }
      }

      // Salary compatibility
      if (requirements.salaryMax !== undefined && profile.salaryMin !== undefined) {
        if (profile.salaryMin <= requirements.salaryMax) {
          score += 10;
          matchReasons.push("Salary expectations compatible");
        } else {
          score -= 15;
        }
      }

      // Remote preference match
      if (requirements.remote === true && profile.remotePreference === "remote") {
        score += 10;
        matchReasons.push("Remote preference aligned");
      }

      return {
        candidateId: candidate.id,
        userId: candidate.userId,
        profile,
        score,
        matchReasons,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Enrich with user email
  const enriched = await Promise.all(
    scored.map(async (c) => {
      const [user] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, c.userId))
        .limit(1);
      return { ...c, email: user?.email, name: user?.name };
    })
  );

  return {
    success: true,
    data: { candidates: enriched, total: enriched.length },
  };
}

// ─── Tool: record_employer_interest ──────────────────────────────────────────

export async function recordEmployerInterest(
  userId: string,
  roleId: string,
  candidateId: string
): Promise<ToolResult> {
  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  if (!employer) {
    return { success: false, error: "Employer not found" };
  }

  // Verify role belongs to this employer
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.employerId, employer.id)))
    .limit(1);

  if (!role) {
    return { success: false, error: "Role not found or not owned by you" };
  }

  // Idempotency: check for existing interest
  const [existing] = await db
    .select()
    .from(employerInterests)
    .where(
      and(
        eq(employerInterests.roleId, roleId),
        eq(employerInterests.candidateId, candidateId)
      )
    )
    .limit(1);

  if (existing) {
    return { success: true, data: { alreadyInterested: true } };
  }

  await db.insert(employerInterests).values({ roleId, candidateId });

  // Get the candidate's user ID for match notification
  const [candidate] = await db
    .select({ userId: candidates.userId })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate not found" };
  }

  // Check for mutual match (employer-first path)
  const matchResult = await checkMutualMatch(
    candidateId,
    roleId,
    candidate.userId
  );

  if (matchResult.matched) {
    return {
      success: true,
      data: {
        match: true,
        matchId: matchResult.matchId,
        message: "It's a match! Sending warm introduction to both parties.",
      },
    };
  }

  return {
    success: true,
    data: {
      match: false,
      message: "Interest recorded. Waiting for candidate to swipe yes.",
    },
  };
}

// ─── Tool: get_employer_roles ─────────────────────────────────────────────────

export async function getEmployerRoles(userId: string): Promise<ToolResult> {
  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  if (!employer) {
    return { success: false, error: "Employer not found" };
  }

  const employerRoles = await db
    .select()
    .from(roles)
    .where(and(eq(roles.employerId, employer.id), eq(roles.isActive, true)));

  return {
    success: true,
    data: {
      roles: employerRoles.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        requirements: JSON.parse(r.requirements),
      })),
    },
  };
}
