/**
 * Raj's tool implementations.
 * These are plain server-side functions — NOT HTTP endpoints.
 * Only the Raj agent API route calls them, server-side.
 */

import { db } from "@/lib/db";
import {
  candidates,
  roles,
  jobSwipes,
  conversations,
  messages,
  salaryBenchmarks,
  employers,
} from "@/lib/db/schema";
import { CandidateProfileSchema, type ToolResult } from "@/lib/types";
import { eq, and, ne, notInArray, sql } from "drizzle-orm";
import { checkMutualMatch } from "@/lib/tools/match";

// ─── Tool: update_candidate_profile ──────────────────────────────────────────

export async function updateCandidateProfile(
  userId: string,
  fields: unknown
): Promise<ToolResult> {
  const parsed = CandidateProfileSchema.safeParse(fields);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid profile data: ${parsed.error.message}`,
    };
  }

  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate profile not found" };
  }

  // Merge with existing profile rather than replace
  const existing = JSON.parse(candidate.profile) as Record<string, unknown>;
  const merged = { ...existing, ...parsed.data };

  await db
    .update(candidates)
    .set({ profile: JSON.stringify(merged), updatedAt: new Date() })
    .where(eq(candidates.userId, userId));

  return { success: true, data: { profile: merged } };
}

// ─── Tool: search_jobs ────────────────────────────────────────────────────────

export async function searchJobs(
  userId: string,
  filters?: {
    limit?: number;
    skills?: string[];
    location?: string;
    remote?: boolean;
  }
): Promise<ToolResult> {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate not found" };
  }

  const profile = JSON.parse(candidate.profile) as {
    skills?: string[];
    salaryMin?: number;
    remotePreference?: string;
  };

  // Get roles already swiped on to exclude them
  const swiped = await db
    .select({ roleId: jobSwipes.roleId })
    .from(jobSwipes)
    .where(eq(jobSwipes.candidateId, candidate.id));

  const swipedIds = swiped.map((s) => s.roleId);

  // SQL scoring: count skill overlaps between candidate and role requirements
  // This runs pure SQL — no vector search needed
  let query = db
    .select({
      id: roles.id,
      title: roles.title,
      description: roles.description,
      requirements: roles.requirements,
      employerId: roles.employerId,
      companyName: roles.companyName,
      applyUrl: roles.applyUrl,
      source: roles.source,
    })
    .from(roles)
    .where(
      and(
        eq(roles.isActive, true),
        swipedIds.length > 0 ? notInArray(roles.id, swipedIds) : undefined
      )
    )
    .limit(filters?.limit ?? 10);

  const jobResults = await query;

  // Score each role client-side (for learning project scale; move to SQL for scale)
  const scored = jobResults
    .map((role) => {
      const req = JSON.parse(role.requirements) as {
        skills?: string[];
        salaryMin?: number;
        salaryMax?: number;
        remote?: boolean;
      };
      let score = 0;

      // Skill overlap
      const candidateSkills = (profile.skills ?? []).map((s) => s.toLowerCase());
      const roleSkills = (req.skills ?? []).map((s) => s.toLowerCase());
      const overlap = candidateSkills.filter((s) => roleSkills.includes(s));
      score += overlap.length * 10;

      // Salary match
      if (profile.salaryMin && req.salaryMax) {
        if (profile.salaryMin <= req.salaryMax) score += 15;
      }

      // Remote match
      if (
        profile.remotePreference === "remote" &&
        req.remote === true
      ) {
        score += 20;
      }

      return {
        ...role,
        score,
        matchedSkills: overlap,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Enrich with company name — external jobs store it directly on the role
  const enriched = await Promise.all(
    scored.map(async (role) => {
      // External jobs already have companyName on the role row
      if (role.companyName) {
        return { ...role };
      }
      // Internal roles: look up employer
      if (role.employerId) {
        const [employer] = await db
          .select({ companyName: employers.companyName })
          .from(employers)
          .where(eq(employers.id, role.employerId))
          .limit(1);
        return { ...role, companyName: employer?.companyName ?? "Unknown Company" };
      }
      return { ...role, companyName: "Unknown Company" };
    })
  );

  return { success: true, data: { jobs: enriched, total: enriched.length } };
}

// ─── Tool: record_swipe ───────────────────────────────────────────────────────

export async function recordSwipe(
  userId: string,
  roleId: string,
  direction: "yes" | "no",
  rajReason?: string
): Promise<ToolResult> {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate not found" };
  }

  // Check for existing swipe (idempotency)
  const [existing] = await db
    .select()
    .from(jobSwipes)
    .where(
      and(
        eq(jobSwipes.candidateId, candidate.id),
        eq(jobSwipes.roleId, roleId)
      )
    )
    .limit(1);

  if (existing) {
    return { success: true, data: { alreadySwiped: true, direction: existing.direction } };
  }

  await db.insert(jobSwipes).values({
    candidateId: candidate.id,
    roleId,
    direction,
    rajReason,
  });

  // If candidate swiped yes, check for mutual match
  if (direction === "yes") {
    const matchResult = await checkMutualMatch(candidate.id, roleId, userId);
    if (matchResult.matched) {
      return {
        success: true,
        data: {
          direction,
          match: true,
          matchId: matchResult.matchId,
          message: "It's a match! Prachi will send a warm introduction.",
        },
      };
    }
  }

  return { success: true, data: { direction, match: false } };
}

// ─── Tool: run_mock_interview ─────────────────────────────────────────────────

export async function runMockInterview(
  userId: string,
  roleId: string
): Promise<ToolResult> {
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  if (!role) {
    return { success: false, error: "Role not found" };
  }

  // Check if an interview is already in progress for this role
  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.agent, "raj"),
        eq(conversations.isInterviewSession, true),
        eq(conversations.roleId, roleId),
        eq(conversations.interviewComplete, false)
      )
    )
    .limit(1);

  if (existing) {
    return {
      success: true,
      data: {
        conversationId: existing.id,
        alreadyInProgress: true,
        message: `Interview for ${role.title} already in progress.`,
      },
    };
  }

  const [conversation] = await db
    .insert(conversations)
    .values({
      userId,
      agent: "raj",
      roleId,
      isInterviewSession: true,
    })
    .returning();

  if (!conversation) {
    return { success: false, error: "Failed to create interview session" };
  }

  return {
    success: true,
    data: {
      conversationId: conversation.id,
      roleTitle: role.title,
      message: `Interview session started for ${role.title}. I'll ask you 5 questions — answer as if this were the real thing.`,
    },
  };
}

// ─── Tool: give_interview_feedback ────────────────────────────────────────────

export async function giveInterviewFeedback(
  conversationId: string
): Promise<ToolResult> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation || !conversation.isInterviewSession) {
    return { success: false, error: "Interview session not found" };
  }

  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  if (sessionMessages.length < 2) {
    return {
      success: false,
      error: "Interview hasn't started yet — no answers to evaluate.",
    };
  }

  // Count user responses (answers)
  const userAnswers = sessionMessages.filter((m) => m.role === "user");

  // Mark interview as complete
  await db
    .update(conversations)
    .set({ interviewComplete: true })
    .where(eq(conversations.id, conversationId));

  // Return the transcript for Raj to evaluate using his AI reasoning
  // Raj will analyze this in his system prompt — no separate scoring tool needed
  return {
    success: true,
    data: {
      conversationId,
      answerCount: userAnswers.length,
      transcript: sessionMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      message:
        "Interview complete. Analyzing your performance across clarity, relevance, and specificity.",
    },
  };
}

// ─── Tool: salary_benchmark ───────────────────────────────────────────────────

export async function salaryBenchmark(
  role: string,
  level: string,
  location: string
): Promise<ToolResult> {
  // Try exact match first
  const normalizedRole = role.toLowerCase().trim();
  const normalizedLevel = level.toLowerCase().trim();
  const normalizedLocation = location.toLowerCase().trim();

  const results = await db
    .select()
    .from(salaryBenchmarks)
    .where(
      and(
        sql`LOWER(${salaryBenchmarks.role}) = ${normalizedRole}`,
        sql`LOWER(${salaryBenchmarks.level}) = ${normalizedLevel}`,
        sql`LOWER(${salaryBenchmarks.location}) = ${normalizedLocation}`
      )
    )
    .limit(1);

  if (results[0]) {
    return {
      success: true,
      data: {
        role,
        level,
        location,
        p25: results[0].p25,
        p50: results[0].p50,
        p75: results[0].p75,
        currency: "USD",
        note: "Based on market data for this role, level, and location.",
      },
    };
  }

  // Fuzzy fallback: try just role + level with any location
  const fallback = await db
    .select()
    .from(salaryBenchmarks)
    .where(
      and(
        sql`LOWER(${salaryBenchmarks.role}) = ${normalizedRole}`,
        sql`LOWER(${salaryBenchmarks.level}) = ${normalizedLevel}`
      )
    )
    .limit(1);

  if (fallback[0]) {
    return {
      success: true,
      data: {
        role,
        level,
        location,
        p25: fallback[0].p25,
        p50: fallback[0].p50,
        p75: fallback[0].p75,
        currency: "USD",
        note: `Location-specific data not available for ${location}. Showing national average.`,
      },
    };
  }

  return {
    success: false,
    error: `No salary data found for ${role} (${level}) in ${location}. I can share general market context instead.`,
  };
}
