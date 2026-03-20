"use client";

import { useState, useRef } from "react";
import type { CandidateProfile } from "@/lib/types";

interface ProfileEditorProps {
  initialProfile: CandidateProfile;
}

const EXPERIENCE_OPTIONS = ["0-1", "1-3", "3-5", "5-10", "10+"] as const;
const REMOTE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
  { value: "flexible", label: "Flexible" },
] as const;

export function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  const [profile, setProfile] = useState<CandidateProfile>(initialProfile);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [skillInput, setSkillInput] = useState("");
  const [industryInput, setIndustryInput] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = async (updated: CandidateProfile) => {
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);

    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setStatus("saved");
      saveTimer.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("idle");
    }
  };

  const update = (patch: Partial<CandidateProfile>) => {
    const updated = { ...profile, ...patch };
    setProfile(updated);
    save(updated);
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (!skill) return;
    const skills = [...(profile.skills ?? [])];
    if (!skills.includes(skill)) {
      update({ skills: [...skills, skill] });
    }
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    update({ skills: (profile.skills ?? []).filter((s) => s !== skill) });
  };

  const addIndustry = () => {
    const industry = industryInput.trim();
    if (!industry) return;
    const industries = [...(profile.industries ?? [])];
    if (!industries.includes(industry)) {
      update({ industries: [...industries, industry] });
    }
    setIndustryInput("");
  };

  const removeIndustry = (industry: string) => {
    update({ industries: (profile.industries ?? []).filter((i) => i !== industry) });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Save status */}
      <div className="flex items-center justify-end h-5">
        {status === "saving" && (
          <span className="text-xs text-gray-400">Saving...</span>
        )}
        {status === "saved" && (
          <span className="text-xs text-green-500">Saved</span>
        )}
      </div>

      {/* Current Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Current title
        </label>
        <input
          type="text"
          value={profile.currentTitle ?? ""}
          onChange={(e) => update({ currentTitle: e.target.value || undefined })}
          placeholder="e.g. Senior Software Engineer"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
        />
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Bio / summary
        </label>
        <textarea
          value={profile.summary ?? ""}
          onChange={(e) => update({ summary: e.target.value || undefined })}
          placeholder="A sentence or two about you and what you're looking for..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
        />
      </div>

      {/* Years of Experience */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Years of experience
        </label>
        <div className="flex gap-2 flex-wrap">
          {EXPERIENCE_OPTIONS.map((opt) => {
            const yoe = opt === "10+" ? 10 : parseInt(opt.split("-")[1] ?? opt);
            const isActive = profile.yearsOfExperience === yoe;
            return (
              <button
                key={opt}
                onClick={() => update({ yearsOfExperience: yoe })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Skills
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(profile.skills ?? []).map((skill) => (
            <span
              key={skill}
              className="flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-sm"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="text-amber-400 hover:text-amber-700 ml-0.5 leading-none"
                aria-label={`Remove ${skill}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="Type a skill, press Enter"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
          <button
            onClick={addSkill}
            className="px-3 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Industries */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Industries
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(profile.industries ?? []).map((industry) => (
            <span
              key={industry}
              className="flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-sm"
            >
              {industry}
              <button
                onClick={() => removeIndustry(industry)}
                className="text-blue-400 hover:text-blue-700 ml-0.5 leading-none"
                aria-label={`Remove ${industry}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={industryInput}
            onChange={(e) => setIndustryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addIndustry();
              }
            }}
            placeholder="e.g. Fintech, Healthcare"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
          <button
            onClick={addIndustry}
            className="px-3 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Remote preference */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Work style preference
        </label>
        <div className="flex gap-2 flex-wrap">
          {REMOTE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update({ remotePreference: value })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                profile.remotePreference === value
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Salary range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Salary range
        </label>
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <input
              type="number"
              value={profile.salaryMin ?? ""}
              onChange={(e) =>
                update({ salaryMin: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Min (e.g. 80000)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>
          <span className="text-gray-400 text-sm">to</span>
          <div className="flex-1">
            <input
              type="number"
              value={profile.salaryMax ?? ""}
              onChange={(e) =>
                update({ salaryMax: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Max (e.g. 120000)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
