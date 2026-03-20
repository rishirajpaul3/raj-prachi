"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Job {
  id: string;
  title: string;
  companyName: string;
  description: string;
  applyUrl: string | null;
  requirements: {
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    remote?: boolean;
    skills?: string[];
  };
  score: number;
  matchedSkills?: string[];
  rajReason?: string;
}

interface JobListProps {
  jobs: Job[];
}

export function JobList({ jobs: initialJobs }: JobListProps) {
  const [search, setSearch] = useState("");
  const [remoteFilter, setRemoteFilter] = useState<"all" | "remote" | "onsite">("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set());
  const [deadError, setDeadError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = initialJobs.filter((j) => !deadIds.has(j.id));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.companyName.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          j.matchedSkills?.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (remoteFilter === "remote") {
      result = result.filter((j) => j.requirements.remote === true);
    } else if (remoteFilter === "onsite") {
      result = result.filter((j) => !j.requirements.remote);
    }

    return result;
  }, [initialJobs, search, remoteFilter, deadIds]);

  const handleSave = async (job: Job) => {
    if (savedIds.has(job.id) || savingId === job.id) return;
    setSavingId(job.id);
    setSavedIds((prev) => new Set([...prev, job.id])); // optimistic

    try {
      await fetch("/api/jobs/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: job.id,
          direction: "yes",
          rajReason: job.rajReason,
        }),
      });
    } catch {
      // Non-critical — swipe recording failure doesn't undo the save UI
    } finally {
      setSavingId(null);
    }
  };

  const handleApply = async (job: Job) => {
    if (!job.applyUrl) return;
    setCheckingId(job.id);
    setDeadError(null);

    try {
      const res = await fetch(`/api/jobs/${job.id}/check-url`);
      const data = (await res.json()) as { alive: boolean };

      if (!data.alive) {
        setDeadIds((prev) => new Set([...prev, job.id]));
        setDeadError(`"${job.title}" is no longer available and has been removed.`);
        setTimeout(() => setDeadError(null), 6000);
        return;
      }

      window.open(job.applyUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Network error — open URL anyway
      window.open(job.applyUrl, "_blank", "noopener,noreferrer");
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search + filters — sticky */}
      <div className="px-4 pt-4 pb-3 bg-[#FFF8F0] border-b border-amber-100 sticky top-0 z-10">
        <input
          type="search"
          placeholder="Search jobs, companies, skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        />
        <div className="flex gap-2 mt-2">
          {(["all", "remote", "onsite"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRemoteFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                remoteFilter === f
                  ? "bg-amber-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-amber-300 hover:text-amber-700"
              }`}
            >
              {f === "all" ? "All Jobs" : f === "remote" ? "🌐 Remote" : "🏢 Onsite"}
            </button>
          ))}
        </div>
      </div>

      {/* Dead link notice */}
      {deadError && (
        <div className="mx-4 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {deadError}
        </div>
      )}

      {/* Job count */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-gray-400">
          {filtered.length} job{filtered.length !== 1 ? "s" : ""} · sorted by match
        </p>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-3xl">🔍</div>
            <p className="text-sm font-medium text-gray-700">No jobs match your filters</p>
            <p className="text-xs text-gray-500">Try a different keyword or filter</p>
            {(search || remoteFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setRemoteFilter("all");
                }}
                className="text-xs text-amber-600 underline mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                isSaving={savingId === job.id}
                isChecking={checkingId === job.id}
                onSave={handleSave}
                onApply={handleApply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isSaved,
  isSaving,
  isChecking,
  onSave,
  onApply,
}: {
  job: Job;
  isSaved: boolean;
  isSaving: boolean;
  isChecking: boolean;
  onSave: (job: Job) => void;
  onApply: (job: Job) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const salaryStr =
    job.requirements.salaryMin && job.requirements.salaryMax
      ? `$${Math.round(job.requirements.salaryMin / 1000)}k–$${Math.round(job.requirements.salaryMax / 1000)}k`
      : job.requirements.salaryMax
      ? `Up to $${Math.round(job.requirements.salaryMax / 1000)}k`
      : null;

  const matchColor =
    job.score >= 60
      ? "text-green-700 bg-green-50"
      : job.score >= 30
      ? "text-amber-700 bg-amber-50"
      : "text-gray-500 bg-gray-100";

  const location = job.requirements.location;
  const showLocation = location && location !== "Various" && location !== "Remote";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{job.title}</h3>
          <p className="text-amber-700 text-xs mt-0.5">{job.companyName}</p>
        </div>
        {job.score > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${matchColor}`}>
            {Math.min(job.score, 100)}%
          </span>
        )}
      </div>

      {/* Meta pills */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {showLocation && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            📍 {location}
          </span>
        )}
        {job.requirements.remote && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            🌐 Remote
          </span>
        )}
        {salaryStr && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            💰 {salaryStr}
          </span>
        )}
      </div>

      {/* Description preview */}
      {job.description && (
        <div className="mt-2">
          <p
            className={`text-xs text-gray-600 leading-relaxed ${
              !expanded ? "line-clamp-2 overflow-hidden" : ""
            }`}
          >
            {job.description}
          </p>
          {job.description.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-amber-600 mt-0.5 hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Raj's reason */}
      {job.rajReason && (
        <p className="text-xs italic text-amber-700 mt-2 leading-relaxed border-t border-amber-50 pt-2">
          "{job.rajReason}"
        </p>
      )}

      {/* Matched skills */}
      {job.matchedSkills && job.matchedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {job.matchedSkills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSave(job)}
          disabled={isSaved || isSaving}
          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
            isSaved
              ? "bg-amber-100 text-amber-700 border border-amber-200"
              : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
          }`}
        >
          {isSaved ? "♥ Saved" : isSaving ? "Saving..." : "♡ Save"}
        </button>

        <Link
          href={`/prep/${job.id}`}
          className="flex-1 py-2 rounded-xl text-xs font-medium text-center bg-blue-50 text-[#1E3A5F] hover:bg-blue-100 transition-colors"
        >
          Prep
        </Link>

        {job.applyUrl && (
          <button
            onClick={() => onApply(job)}
            disabled={isChecking}
            className="flex-1 py-2 rounded-xl text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-60"
          >
            {isChecking ? "..." : "Apply →"}
          </button>
        )}
      </div>
    </div>
  );
}
