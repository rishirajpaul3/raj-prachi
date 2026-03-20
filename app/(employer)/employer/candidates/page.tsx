import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  employers,
  roles,
  candidates,
  employerInterests,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { CandidateProfile } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.userId, userId))
    .limit(1);

  if (!employer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
          💬
        </div>
        <h2 className="font-semibold text-gray-900">Chat with Prachi first</h2>
        <p className="text-sm text-gray-500">
          Prachi needs to create your company profile and a role before she can
          find candidates.
        </p>
        <Link
          href="/employer/chat"
          className="px-5 py-2.5 bg-[#1E3A5F] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          Talk to Prachi
        </Link>
      </div>
    );
  }

  const employerRoles = await db
    .select()
    .from(roles)
    .where(and(eq(roles.employerId, employer.id), eq(roles.isActive, true)));

  if (employerRoles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
          📋
        </div>
        <h2 className="font-semibold text-gray-900">No roles yet</h2>
        <p className="text-sm text-gray-500">
          Ask Prachi to create a role, then she&apos;ll surface matching
          candidates here.
        </p>
        <Link
          href="/employer/chat"
          className="px-5 py-2.5 bg-[#1E3A5F] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          Create a role with Prachi
        </Link>
      </div>
    );
  }

  // For simplicity, show candidates for the first active role
  // (Prachi handles multi-role logic via chat)
  const activeRole = employerRoles[0]!;
  const requirements = JSON.parse(activeRole.requirements) as {
    skills?: string[];
    mustHave?: string[];
    minYearsExperience?: number;
    salaryMax?: number;
    remote?: boolean;
  };

  // Get candidates already marked as interested
  const interested = await db
    .select({ candidateId: employerInterests.candidateId })
    .from(employerInterests)
    .where(eq(employerInterests.roleId, activeRole.id));

  const interestedIds = new Set(interested.map((i) => i.candidateId));

  const allCandidates = await db.select().from(candidates);

  const scored = await Promise.all(
    allCandidates
      .filter((c) => !interestedIds.has(c.id))
      .map(async (candidate) => {
        const profile = JSON.parse(candidate.profile) as CandidateProfile;
        const candidateSkills = (profile.skills ?? []).map((s) => s.toLowerCase());
        const roleSkills = (requirements.skills ?? []).map((s) => s.toLowerCase());
        const mustHave = (requirements.mustHave ?? []).map((s) => s.toLowerCase());

        let score = 0;
        const matchReasons: string[] = [];

        const overlap = candidateSkills.filter((s) => roleSkills.includes(s));
        if (overlap.length > 0) {
          score += overlap.length * 10;
          matchReasons.push(`${overlap.length} skill match${overlap.length > 1 ? "es" : ""}`);
        }

        if (mustHave.every((s) => candidateSkills.includes(s)) && mustHave.length > 0) {
          score += 30;
          matchReasons.push("all must-haves");
        } else if (mustHave.length > 0) {
          score -= 20;
        }

        if (requirements.minYearsExperience && profile.yearsOfExperience) {
          if (profile.yearsOfExperience >= requirements.minYearsExperience) {
            score += 15;
            matchReasons.push(`${profile.yearsOfExperience}y exp`);
          }
        }

        const [user] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, candidate.userId))
          .limit(1);

        return { candidate, profile, score, matchReasons, user, overlap };
      })
  );

  const topCandidates = scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return (
    <div className="h-full overflow-y-auto pb-20">
      <div className="px-4 py-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Candidates for {activeRole.title}
          </h2>
          <p className="text-sm text-gray-500">
            {employerRoles.length > 1
              ? `${employerRoles.length} open roles — showing top matches. Ask Prachi to switch roles.`
              : "Ask Prachi to mark candidates as interested."}
          </p>
        </div>

        {topCandidates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">
              No strong matches yet. The candidate pool is still growing.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Consider broadening the role requirements with Prachi.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {topCandidates.map(({ candidate, profile, score, matchReasons, user, overlap }) => (
              <div
                key={candidate.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {user?.name ?? user?.email?.split("@")[0] ?? "Candidate"}
                    </p>
                    {profile.currentTitle && (
                      <p className="text-xs text-[#1E3A5F]">{profile.currentTitle}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#1E3A5F]">
                      {Math.min(score, 100)}% match
                    </span>
                  </div>
                </div>

                {overlap.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {overlap.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="text-xs bg-blue-50 text-[#1E3A5F] border border-blue-200 px-2 py-0.5 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {matchReasons.length > 0 && (
                  <p className="text-xs text-gray-500 italic mb-3">
                    Prachi notes: {matchReasons.join(", ")}
                  </p>
                )}

                <p className="text-xs text-gray-400">
                  Ask Prachi to connect you with this candidate.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
