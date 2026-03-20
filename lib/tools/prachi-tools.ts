/**
 * Prachi's tool implementations — seeker-focused hiring intelligence.
 * Server-side only. Called exclusively from the Prachi agent API route.
 */

import { db } from "@/lib/db";
import { candidates, roles, employers } from "@/lib/db/schema";
import { type ToolResult, type CandidateProfile, type RoleRequirements } from "@/lib/types";
import { eq, and } from "drizzle-orm";

// ─── Tool: get_job_details ────────────────────────────────────────────────────

export async function getJobDetails(roleId: string): Promise<ToolResult> {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.isActive, true)))
    .limit(1);

  if (!role) {
    return { success: false, error: "Job not found" };
  }

  // Resolve company name: use role.companyName for external jobs, employer record for internal
  let companyName = role.companyName;
  if (!companyName && role.employerId) {
    const [employer] = await db
      .select({ companyName: employers.companyName })
      .from(employers)
      .where(eq(employers.id, role.employerId))
      .limit(1);
    companyName = employer?.companyName ?? null;
  }

  const requirements = JSON.parse(role.requirements) as RoleRequirements;

  return {
    success: true,
    data: {
      id: role.id,
      title: role.title,
      companyName: companyName ?? "Unknown Company",
      description: role.description,
      requirements,
      applyUrl: role.applyUrl,
      source: role.source,
    },
  };
}

// ─── Tool: get_candidate_profile ──────────────────────────────────────────────

export async function getCandidateProfile(userId: string): Promise<ToolResult> {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate profile not found" };
  }

  const profile = JSON.parse(candidate.profile) as CandidateProfile;

  return {
    success: true,
    data: { profile },
  };
}

// ─── Tool: analyze_fit ────────────────────────────────────────────────────────

export async function analyzeFit(
  userId: string,
  roleId: string
): Promise<ToolResult> {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate) {
    return { success: false, error: "Candidate not found" };
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.isActive, true)))
    .limit(1);

  if (!role) {
    return { success: false, error: "Role not found" };
  }

  const profile = JSON.parse(candidate.profile) as CandidateProfile;
  const req = JSON.parse(role.requirements) as RoleRequirements;

  // Skill analysis
  const candidateSkills = (profile.skills ?? []).map((s) => s.toLowerCase());
  const requiredSkills = (req.skills ?? []).map((s) => s.toLowerCase());
  const mustHave = (req.mustHave ?? []).map((s) => s.toLowerCase());

  const matchingSkills = candidateSkills.filter((s) => requiredSkills.includes(s));
  const missingSkills = requiredSkills.filter((s) => !candidateSkills.includes(s));
  const missingMustHave = mustHave.filter((s) => !candidateSkills.includes(s));

  // Score (0-100)
  let score = 0;
  const strengths: string[] = [];
  const gaps: string[] = [];
  const tailoring: string[] = [];

  if (matchingSkills.length > 0) {
    score += Math.min(40, matchingSkills.length * 8);
    strengths.push(`Skills match: ${matchingSkills.join(", ")}`);
    tailoring.push(`Lead with these skills prominently: ${matchingSkills.slice(0, 3).join(", ")}`);
  }

  if (missingMustHave.length === 0 && mustHave.length > 0) {
    score += 20;
    strengths.push("Has all must-have requirements");
  } else if (missingMustHave.length > 0) {
    gaps.push(`Missing must-have skills: ${missingMustHave.join(", ")}`);
    tailoring.push(`Address the skill gap for ${missingMustHave[0]} — consider a side project or online course to demonstrate it`);
  }

  if (missingSkills.length > 0 && missingMustHave.length === 0) {
    gaps.push(`Nice-to-have gaps: ${missingSkills.join(", ")}`);
  }

  // Experience
  if (profile.yearsOfExperience !== undefined) {
    if (req.minYearsExperience !== undefined) {
      if (profile.yearsOfExperience >= req.minYearsExperience) {
        score += 15;
        strengths.push(`${profile.yearsOfExperience} years experience (meets ${req.minYearsExperience}yr minimum)`);
      } else {
        gaps.push(`Experience gap: ${profile.yearsOfExperience}yrs vs ${req.minYearsExperience}yr requirement — frame your projects to show impact, not tenure`);
      }
    } else {
      score += 10;
    }
  }

  // Salary
  if (profile.salaryMin !== undefined && req.salaryMax !== undefined) {
    if (profile.salaryMin <= req.salaryMax) {
      score += 10;
      strengths.push("Salary expectations align with role budget");
    } else {
      gaps.push(`Salary mismatch: your floor ($${profile.salaryMin.toLocaleString()}) exceeds their ceiling ($${req.salaryMax.toLocaleString()})`);
    }
  }

  // Remote
  if (req.remote === true && profile.remotePreference === "remote") {
    score += 5;
    strengths.push("Remote preference aligned");
  }

  // General tailoring advice
  tailoring.push(`Mirror the job description language in your resume headline and summary`);
  tailoring.push(`Quantify impact in each bullet — numbers matter more than responsibilities`);

  return {
    success: true,
    data: {
      roleId,
      roleTitle: role.title,
      companyName: role.companyName,
      fitScore: Math.min(100, score),
      strengths,
      gaps,
      tailoring,
      applyUrl: role.applyUrl,
      verdict:
        score >= 60
          ? "Strong fit — apply with confidence"
          : score >= 35
          ? "Partial fit — tailor carefully and address gaps in your cover letter"
          : "Stretch role — apply if you can demonstrate transferable impact",
    },
  };
}
