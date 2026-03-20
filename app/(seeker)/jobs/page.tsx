import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { candidates, roles, jobSwipes, employers } from "@/lib/db/schema";
import { eq, and, notInArray, desc, inArray } from "drizzle-orm";
import { SwipeStack } from "@/components/jobs/SwipeStack";
import Link from "next/link";
import type { CandidateProfile } from "@/lib/types";

// Always re-render so the latest profile/swipes are used for scoring
export const dynamic = "force-dynamic";

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

  const candidateTerms = buildCandidateTerms(profile);
  const hasProfile = candidateTerms.length > 0;

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

    const companyName =
      role.companyName ??
      (role.employerId ? employerMap.get(role.employerId) : undefined) ??
      "Unknown Company";

    const { score, matchedKeywords } = hasProfile
      ? scoreJobForCandidate(profile, candidateTerms, role.title, role.description, req)
      : { score: 0, matchedKeywords: [] as string[] };

    return {
      id: role.id,
      title: role.title,
      companyName,
      requirements: req,
      score,
      matchedSkills: matchedKeywords,
      rajReason: buildRajReason(role.title, matchedKeywords, req, profile),
    };
  });

  // Sort by score desc. If no profile, preserve recency order (all score 0).
  const jobs = scored.sort((a, b) => b.score - a.score).slice(0, 200);

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
      <SwipeStack jobs={jobs} />
    </div>
  );
}

// ─── Scoring engine ────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","up","about","into","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","should","could","may",
  "might","can","this","that","these","those","we","you","they","our","your",
  "their","its","as","not","more","also","than","when","how","all","both",
  "each","such","if","no","nor","so","yet","whether","very","just","new",
  "work","working","experience","skills","team","role","position","join","help",
  "looking","seeking","required","requirements","strong","excellent","good",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Build the set of terms that represent this candidate.
 * Includes multi-word phrases (kept intact) AND individual word tokens.
 */
function buildCandidateTerms(profile: CandidateProfile): string[] {
  const terms = new Set<string>();

  const addPhrase = (phrase: string) => {
    const lower = phrase.toLowerCase().trim();
    if (lower.length > 2) terms.add(lower);
    // Also add individual tokens so "content marketing" also fires on "content"
    for (const w of tokenize(lower)) terms.add(w);
  };

  for (const s of profile.skills ?? []) addPhrase(s);
  for (const i of profile.industries ?? []) addPhrase(i);
  if (profile.currentTitle) for (const w of tokenize(profile.currentTitle)) terms.add(w);
  if (profile.careerGoals) for (const w of tokenize(profile.careerGoals)) terms.add(w);
  if (profile.summary) for (const w of tokenize(profile.summary)) terms.add(w);

  return [...terms];
}

interface ParsedReq {
  skills?: string[];
  salaryMin?: number;
  salaryMax?: number;
  remote?: boolean;
  location?: string;
  minYearsExperience?: number;
  maxYearsExperience?: number;
  industry?: string;
  level?: string;
}

/**
 * Score a job against a candidate profile.
 *
 * Scoring (max 100):
 *   Text relevance  — 60 pts: candidate terms found in title (5 pts) or description (2 pts)
 *   Tag overlap     — 20 pts: structured skill tags (5 pts each, max 4 matches)
 *   Preferences     — 20 pts: remote (8), salary (6), experience (6)
 */
function scoreJobForCandidate(
  profile: CandidateProfile,
  candidateTerms: string[],
  jobTitle: string,
  jobDescription: string,
  req: ParsedReq
): { score: number; matchedKeywords: string[] } {
  const titleTokens = new Set(tokenize(jobTitle));
  const fullText = `${jobTitle} ${jobDescription}`.toLowerCase();
  const fullTokens = new Set(tokenize(fullText));

  // Multi-word phrase check (e.g. "content marketing" as substring)
  const multiWord = candidateTerms.filter((t) => t.includes(" "));
  const singleWord = candidateTerms.filter((t) => !t.includes(" "));

  let textPts = 0;
  const matched = new Set<string>();

  for (const phrase of multiWord) {
    if (fullText.includes(phrase)) {
      textPts += jobTitle.toLowerCase().includes(phrase) ? 8 : 3;
      matched.add(phrase);
    }
  }

  for (const word of singleWord) {
    if (titleTokens.has(word)) {
      textPts += 5;
      matched.add(word);
    } else if (fullTokens.has(word)) {
      textPts += 2;
      matched.add(word);
    }
  }

  const textScore = Math.min(textPts, 60);

  // Structured tag overlap (max 20)
  const profileTags = (profile.skills ?? []).map((s) => s.toLowerCase());
  const roleTags = (req.skills ?? []).map((s) => s.toLowerCase());
  const tagMatches = profileTags.filter((s) => roleTags.includes(s));
  const tagScore = Math.min(tagMatches.length * 5, 20);
  for (const t of tagMatches) matched.add(t);

  // Preferences (max 20)
  let prefScore = 0;
  if (profile.remotePreference === "remote" && req.remote) prefScore += 8;
  else if (profile.remotePreference === "onsite" && !req.remote) prefScore += 5;
  else if (profile.remotePreference === "hybrid") prefScore += 4;

  if (profile.salaryMin && req.salaryMax && profile.salaryMin <= req.salaryMax) prefScore += 6;

  if (profile.yearsOfExperience !== undefined) {
    const min = req.minYearsExperience ?? 0;
    const max = req.maxYearsExperience ?? 99;
    if (profile.yearsOfExperience >= min && profile.yearsOfExperience <= max) prefScore += 6;
  }

  const score = textScore + tagScore + prefScore;

  // Surface the most informative matched keywords (prefer multi-word, then shortest)
  const displayKeywords = [...matched]
    .sort((a, b) => {
      const aMulti = a.includes(" ") ? 0 : 1;
      const bMulti = b.includes(" ") ? 0 : 1;
      return aMulti - bMulti || a.length - b.length;
    })
    .slice(0, 5);

  return { score, matchedKeywords: displayKeywords };
}

function buildRajReason(
  roleTitle: string,
  matchedKeywords: string[],
  req: ParsedReq,
  profile: CandidateProfile
): string {
  const parts: string[] = [];

  if (matchedKeywords.length > 0) {
    const kws = matchedKeywords.slice(0, 2).join(" and ");
    parts.push(`your ${kws} background matches what they need`);
  }

  if (req.remote && profile.remotePreference === "remote") {
    parts.push("it's fully remote");
  }

  if (profile.salaryMin && req.salaryMax && profile.salaryMin <= req.salaryMax) {
    parts.push("the comp fits your range");
  }

  if (parts.length === 0) {
    return `This ${roleTitle} role could be worth a look based on your background.`;
  }

  return `Picked this because ${parts.join(", and ")}.`;
}
