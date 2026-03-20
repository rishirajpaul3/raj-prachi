import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { candidates, roles, jobSwipes, employers } from "@/lib/db/schema";
import { eq, and, notInArray, desc, inArray } from "drizzle-orm";
import { SwipeStack } from "@/components/jobs/SwipeStack";
import Link from "next/link";
import type { CandidateProfile } from "@/lib/types";

export default async function JobsPage() {
  const userId = await requireSession();

  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  const profile = candidate
    ? (JSON.parse(candidate.profile) as CandidateProfile)
    : ({} as CandidateProfile);
  const hasProfile = Object.keys(profile).length > 0;

  // Get swiped role IDs (only if candidate row exists)
  const swipedIds: string[] = [];
  if (candidate) {
    const swiped = await db
      .select({ roleId: jobSwipes.roleId })
      .from(jobSwipes)
      .where(eq(jobSwipes.candidateId, candidate.id));
    swipedIds.push(...swiped.map((s) => s.roleId));
  }

  // Fetch ALL active unswiped jobs — no artificial limit
  const allRoles = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.isActive, true),
        swipedIds.length > 0 ? notInArray(roles.id, swipedIds) : undefined
      )
    )
    .orderBy(desc(roles.createdAt));

  // Batch-fetch all needed employer names in one query (avoids N+1 with 900+ jobs)
  const missingNameRoleEmployerIds = [
    ...new Set(
      allRoles
        .filter((r) => !r.companyName && r.employerId)
        .map((r) => r.employerId as string)
    ),
  ];

  const employerMap = new Map<string, string>();
  if (missingNameRoleEmployerIds.length > 0) {
    const employerRows = await db
      .select({ id: employers.id, companyName: employers.companyName })
      .from(employers)
      .where(inArray(employers.id, missingNameRoleEmployerIds));
    for (const e of employerRows) employerMap.set(e.id, e.companyName);
  }

  // Score each role with weighted signals
  const candidateSkills = (profile.skills ?? []).map((s) => s.toLowerCase());
  const candidateIndustries = (profile.industries ?? []).map((s) => s.toLowerCase());

  const scored = allRoles.map((role) => {
    const req = JSON.parse(role.requirements) as {
      skills?: string[];
      salaryMin?: number;
      salaryMax?: number;
      remote?: boolean;
      location?: string;
      minYearsExperience?: number;
      maxYearsExperience?: number;
      industry?: string;
      level?: string;
    };

    let score = 0;

    // Skills match — highest weight (40 pts per matched skill)
    const roleSkills = (req.skills ?? []).map((s) => s.toLowerCase());
    const matched = candidateSkills.filter((s) => roleSkills.includes(s));
    score += matched.length * 40;

    // Industry match (20 pts)
    if (req.industry && candidateIndustries.includes(req.industry.toLowerCase())) {
      score += 20;
    }

    // Experience level fit (15 pts)
    if (profile.yearsOfExperience !== undefined) {
      const min = req.minYearsExperience ?? 0;
      const max = req.maxYearsExperience ?? 99;
      if (profile.yearsOfExperience >= min && profile.yearsOfExperience <= max) {
        score += 15;
      }
    }

    // Remote / location preference (20 pts)
    if (profile.remotePreference === "remote" && req.remote) score += 20;
    else if (profile.remotePreference === "onsite" && !req.remote) score += 10;
    else if (profile.remotePreference === "hybrid") score += 5;

    // Salary fit (15 pts)
    if (profile.salaryMin && req.salaryMax && profile.salaryMin <= req.salaryMax) score += 15;

    // Resolve company name — direct field first, then employer map
    const companyName =
      role.companyName ??
      (role.employerId ? employerMap.get(role.employerId) : undefined) ??
      "Unknown Company";

    return {
      id: role.id,
      title: role.title,
      description: role.description,
      companyName,
      requirements: req,
      score,
      matchedSkills: matched,
      rajReason: generateRajReason(role.title, matched, req.remote ?? false, profile),
    };
  });

  // Sort by score desc; 0-score jobs appear at the bottom (not hidden)
  const jobs = scored.sort((a, b) => b.score - a.score);

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
          🔍
        </div>
        <h2 className="font-semibold text-gray-900">You&apos;ve seen everything Raj has for you</h2>
        <p className="text-sm text-gray-500">
          Update your preferences with Raj and he&apos;ll find new matches.
        </p>
        <Link
          href="/chat"
          className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Talk to Raj
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full">
      <SwipeStack jobs={jobs} onEmpty={() => {}} />
    </div>
  );
}

function generateRajReason(
  roleTitle: string,
  matchedSkills: string[],
  isRemote: boolean,
  profile: CandidateProfile
): string {
  const parts: string[] = [];

  if (matchedSkills.length > 0) {
    parts.push(`your ${matchedSkills.slice(0, 2).join(" and ")} experience is a direct match`);
  }

  if (isRemote && profile.remotePreference === "remote") {
    parts.push("it's fully remote");
  }

  if (profile.salaryMin && parts.length < 2) {
    parts.push(`the compensation fits your range`);
  }

  if (parts.length === 0) {
    return `I think the ${roleTitle} role could be a good fit based on your background.`;
  }

  return `I picked this because ${parts.join(" and ")}.`;
}
