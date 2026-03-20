import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import type { CandidateProfile } from "@/lib/types";

export default async function ProfilePage() {
  const userId = await requireSession();

  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  const profile = candidate
    ? (JSON.parse(candidate.profile) as CandidateProfile)
    : {};

  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Your Profile</h2>
        <p className="text-sm text-gray-500 mb-5">
          Raj uses this to find the right roles for you.
        </p>
        <ProfileEditor initialProfile={profile} />
      </div>
    </div>
  );
}
