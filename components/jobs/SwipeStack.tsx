"use client";

import { useState } from "react";
import { SwipeCard } from "./SwipeCard";

interface Job {
  id: string;
  title: string;
  companyName: string;
  description: string;
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

interface SwipeStackProps {
  jobs: Job[];
  onEmpty: () => void;
}

export function SwipeStack({ jobs: initialJobs, onEmpty }: SwipeStackProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [lastSwipe, setLastSwipe] = useState<{
    direction: "yes" | "no";
    title: string;
  } | null>(null);

  const handleSwipe = async (
    job: Job,
    direction: "yes" | "no"
  ) => {
    // Optimistically remove from stack
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    setLastSwipe({ direction, title: job.title });

    // Record swipe via Raj's API
    try {
      await fetch("/api/agents/raj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            direction === "yes"
              ? `I swiped yes on the ${job.title} role at ${job.companyName} (role_id: ${job.id})`
              : `I swiped no on the ${job.title} role at ${job.companyName} (role_id: ${job.id})`,
        }),
      });
    } catch {
      // Swipe recording failure is non-critical — UI has already updated
      console.error("Failed to record swipe via agent");
    }

    if (jobs.length <= 1) {
      onEmpty();
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
          ✓
        </div>
        <h3 className="font-semibold text-gray-900">You've seen everything Raj has for you</h3>
        <p className="text-sm text-gray-500">
          Chat with Raj to update your preferences or explore new types of roles.
        </p>
        <a
          href="/chat"
          className="mt-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Talk to Raj
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Last swipe feedback */}
      {lastSwipe && (
        <div className="px-4 py-2 text-center">
          <span
            className={`text-sm font-medium ${
              lastSwipe.direction === "yes" ? "text-green-600" : "text-gray-400"
            }`}
          >
            {lastSwipe.direction === "yes"
              ? `✓ Interested in ${lastSwipe.title}`
              : `Passed on ${lastSwipe.title}`}
          </span>
        </div>
      )}

      {/* Card stack */}
      <div className="relative flex-1 mx-4">
        {jobs.slice(0, 2).map((job, index) => (
          <SwipeCard
            key={job.id}
            job={job}
            isTop={index === 0}
            onSwipe={(dir) => handleSwipe(job, dir)}
          />
        ))}
      </div>

      {/* Always-visible Yes/No buttons (a11y) */}
      <div className="flex gap-4 px-8 py-4 pb-20" role="group" aria-label="Swipe actions">
        <button
          onClick={() => jobs[0] && handleSwipe(jobs[0], "no")}
          disabled={jobs.length === 0}
          className="flex-1 h-14 rounded-2xl border-2 border-gray-200 text-gray-500 font-semibold hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          aria-label={`Pass on ${jobs[0]?.title ?? "this role"}`}
        >
          ✗ Pass
        </button>
        <button
          onClick={() => jobs[0] && handleSwipe(jobs[0], "yes")}
          disabled={jobs.length === 0}
          className="flex-1 h-14 rounded-2xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          aria-label={`Interested in ${jobs[0]?.title ?? "this role"}`}
        >
          ✓ Yes
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-center text-gray-400 pb-2 hidden md:block">
        ← Pass · → Interested
      </p>
    </div>
  );
}
