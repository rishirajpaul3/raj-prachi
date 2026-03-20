"use client";

import { useState } from "react";
import { useSwipeable } from "react-swipeable";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  title: string;
  companyName: string;
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

interface SwipeCardProps {
  job: Job;
  onSwipe: (direction: "yes" | "no") => void;
  isTop: boolean;
}

export function SwipeCard({ job, onSwipe, isTop }: SwipeCardProps) {
  const [swipeDir, setSwipeDir] = useState<"yes" | "no" | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [deltaX, setDeltaX] = useState(0);

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (!isTop) return;
      setIsSwiping(true);
      setDeltaX(e.deltaX);
      if (e.deltaX > 50) setSwipeDir("yes");
      else if (e.deltaX < -50) setSwipeDir("no");
      else setSwipeDir(null);
    },
    onSwipedRight: () => {
      if (!isTop) return;
      setIsSwiping(false);
      setDeltaX(0);
      onSwipe("yes");
    },
    onSwipedLeft: () => {
      if (!isTop) return;
      setIsSwiping(false);
      setDeltaX(0);
      onSwipe("no");
    },
    onTouchEndOrOnMouseUp: () => {
      if (!isSwiping) return;
      setIsSwiping(false);
      setDeltaX(0);
      setSwipeDir(null);
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const rotation = isTop ? `${(deltaX / 20).toFixed(1)}deg` : "0deg";

  const salaryStr =
    job.requirements.salaryMin && job.requirements.salaryMax
      ? `$${Math.round(job.requirements.salaryMin / 1000)}k–$${Math.round(job.requirements.salaryMax / 1000)}k`
      : job.requirements.salaryMax
      ? `Up to $${Math.round(job.requirements.salaryMax / 1000)}k`
      : null;

  return (
    <div
      {...(isTop ? handlers : {})}
      className={cn(
        "absolute inset-0 bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col select-none",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
        !isTop && "scale-95 translate-y-4 opacity-80"
      )}
      style={{
        transform: isTop
          ? `rotate(${rotation}) translateX(${deltaX * 0.15}px)`
          : undefined,
        transition: isSwiping ? "none" : "transform 0.2s ease",
        zIndex: isTop ? 10 : 0,
      }}
      role="article"
      aria-label={`${job.title} at ${job.companyName}`}
    >
      {/* Swipe direction indicator */}
      {swipeDir === "yes" && (
        <div className="absolute top-4 left-4 border-2 border-green-500 text-green-500 font-bold text-lg px-2 py-0.5 rounded rotate-[-12deg] opacity-80">
          YES
        </div>
      )}
      {swipeDir === "no" && (
        <div className="absolute top-4 right-4 border-2 border-red-400 text-red-400 font-bold text-lg px-2 py-0.5 rounded rotate-[12deg] opacity-80">
          PASS
        </div>
      )}

      {/* Card content */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-gray-900 mb-1">{job.title}</h2>
        <p className="text-amber-700 font-medium mb-3">{job.companyName}</p>

        {/* Meta row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {job.requirements.location && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              📍 {job.requirements.location}
            </span>
          )}
          {job.requirements.remote && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              🌐 Remote
            </span>
          )}
          {salaryStr && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              💰 {salaryStr}
            </span>
          )}
        </div>

        {/* Match strength */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Match strength</span>
            <span className="text-xs font-medium text-amber-600">{Math.min(job.score, 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(job.score, 100)}%` }}
            />
          </div>
        </div>

        {/* Matched skills */}
        {job.matchedSkills && job.matchedSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
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
      </div>

      {/* Raj's reason — the differentiator */}
      {job.rajReason && (
        <div className="border-t border-amber-100 pt-3 mt-2">
          <p className="text-sm italic text-amber-700 leading-relaxed">
            "{job.rajReason}"
          </p>
          <p className="text-xs text-amber-500 mt-0.5">— Raj picked this for you</p>
        </div>
      )}
    </div>
  );
}
