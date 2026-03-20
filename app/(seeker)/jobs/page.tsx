import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { candidates, roles, jobSwipes, employers } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
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

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
          💬
        </div>
        <h2 className="font-semibold text-gray-900">Chat with Raj first</h2>
        <p className="text-sm text-gray-500">
          Raj needs to learn about you before he can find the right jobs.
          Start a conversation and he&apos;ll surface matches once he has a sense of what you&apos;re looking for.
        </p>
        <Link
          href="/chat"
          className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Talk to Raj
        </Link>
      </div>
    );
  }

  const profile = JSON.parse(candidate.profile) as CandidateProfile;
  const hasProfile = Object.keys(profile).length > 0;

  if (!hasProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
          💬
        </div>
        <h2 className="font-semibold text-gray-900">Chat with Raj first</h2>
        <p className="text-sm text-gray-500">
          Raj needs to learn about you before he can find the right jobs.
          Start a conversation and he&apos;ll surface matches once he has a sense of what you&apos;re looking for.
        </p>
        <Link
          href="/chat"
          className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Talk to Raj
        </Link>
      </div>
    );
  }

  // Get swiped role IDs
  const swiped = await db
    .select({ roleId: jobSwipes.roleId })
    .from(jobSwipes)
    .where(eq(jobSwipes.candidateId, candidate.id));

  const swipedIds = swiped.map((s) => s.roleId);

  // Fetch and score active jobs
  const allRoles = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.isActive, true),
        swipedIds.length > 0 ? notInArray(roles.id, swipedIds) : undefined
      )
    )
    .limit(20);

  // Score each role
  const candidateSkills = (profile.skills ?? []).map((s) => s.toLowerCase());

  const scored = await Promise.all(
    allRoles.map(async (role) => {
      const req = JSON.parse(role.requirements) as {
        skills?: string[];
        salaryMin?: number;
        salaryMax?: number;
        remote?: boolean;
        location?: string;
      };

      const roleSkills = (req.skills ?? []).map((s) => s.toLowerCase());
      const matched = candidateSkills.filter((s) => roleSkills.includes(s));

      let score = matched.length * 10;
      if (profile.salaryMin && req.salaryMax && profile.salaryMin <= req.salaryMax) score += 15;
      if (profile.remotePreference === "remote" && req.remote) score += 20;

      // External jobs store companyName directly; internal roles use employer table
      let companyName = role.companyName;
      if (!companyName && role.employerId) {
        const [employer] = await db
          .select({ companyName: employers.companyName })
          .from(employers)
          .where(eq(employers.id, role.employerId))
          .limit(1);
        companyName = employer?.companyName ?? null;
      }

      return {
        id: role.id,
        title: role.title,
        description: role.description,
        companyName: companyName ?? "Unknown Company",
        requirements: req,
        score,
        matchedSkills: matched,
        rajReason: generateRajReason(role.title, matched, req.remote ?? false, profile),
      };
    })
  );

  const jobs = scored
    .filter((j) => j.score >= 0)
    .sort((a, b) => b.score - a.score);

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
