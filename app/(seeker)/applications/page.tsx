import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { candidates, jobSwipes, roles, employers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const userId = await requireSession();

  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="text-3xl">📋</div>
        <h2 className="font-semibold text-gray-900">No applications yet</h2>
        <p className="text-sm text-gray-500">Swipe yes on jobs to track them here.</p>
        <Link href="/jobs" className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors">
          Browse Jobs
        </Link>
      </div>
    );
  }

  // Get all yes-swiped jobs
  const swipes = await db
    .select()
    .from(jobSwipes)
    .where(and(eq(jobSwipes.candidateId, candidate.id), eq(jobSwipes.direction, "yes")))
    .orderBy(desc(jobSwipes.createdAt));

  if (swipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center pb-16">
        <div className="text-3xl">📋</div>
        <h2 className="font-semibold text-gray-900">No applications yet</h2>
        <p className="text-sm text-gray-500">Swipe yes on jobs to track them here.</p>
        <Link href="/jobs" className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors">
          Browse Jobs
        </Link>
      </div>
    );
  }

  // Enrich with role data
  const enriched = await Promise.all(
    swipes.map(async (swipe) => {
      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, swipe.roleId))
        .limit(1);

      if (!role) return null;

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
        swipeId: swipe.id,
        roleId: role.id,
        title: role.title,
        companyName: companyName ?? "Unknown Company",
        applyUrl: role.applyUrl,
        logoUrl: role.logoUrl,
        swipedAt: swipe.createdAt,
        rajReason: swipe.rajReason,
      };
    })
  );

  const jobs = enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[];

  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Applications
          <span className="ml-2 text-sm font-normal text-gray-400">({jobs.length})</span>
        </h2>
        <p className="text-sm text-gray-500 mb-4">Jobs you&apos;ve expressed interest in.</p>

        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div
              key={job.swipeId}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start gap-3">
                {job.logoUrl ? (
                  <img
                    src={job.logoUrl}
                    alt={job.companyName}
                    className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
                    {job.companyName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{job.title}</h3>
                  <p className="text-amber-700 text-xs">{job.companyName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Interested{" "}
                    {new Date(job.swipedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <Link
                  href={`/prep/${job.roleId}`}
                  className="flex-1 text-center text-xs font-medium py-2 rounded-xl bg-blue-50 text-[#1E3A5F] hover:bg-blue-100 transition-colors"
                >
                  Prep with Prachi
                </Link>
                {job.applyUrl && (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-xs font-medium py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  >
                    Apply →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
