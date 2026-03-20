import { z } from "zod";

// ─── Candidate Profile ────────────────────────────────────────────────────────
// Stored as JSON text in candidates.profile. Validated at tool boundary.

export const CandidateProfileSchema = z.object({
  currentTitle: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  skills: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  careerGoals: z.string().optional(),
  preferredLocations: z.array(z.string()).optional(),
  remotePreference: z.enum(["remote", "hybrid", "onsite", "flexible"]).optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  companySizePreference: z.enum(["startup", "mid", "enterprise", "any"]).optional(),
  openToManagement: z.boolean().optional(),
  summary: z.string().optional(),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

// ─── Role Requirements ────────────────────────────────────────────────────────
// Stored as JSON text in roles.requirements. Validated at tool boundary.

export const RoleRequirementsSchema = z.object({
  skills: z.array(z.string()).optional(),
  minYearsExperience: z.number().optional(),
  maxYearsExperience: z.number().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  level: z.string().optional(),
  teamSize: z.number().optional(),
  industry: z.string().optional(),
  mustHave: z.array(z.string()).optional(),
  niceToHave: z.array(z.string()).optional(),
});

export type RoleRequirements = z.infer<typeof RoleRequirementsSchema>;

// ─── Tool call types ──────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Claude message format ────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: "user" | "assistant";
  content:
    | string
    | Array<{
        type: "text" | "tool_use" | "tool_result";
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
        tool_use_id?: string;
        content?: string | Array<{ type: "text"; text: string }>;
        is_error?: boolean;
      }>;
}

// ─── Candidate scoring for find_candidates ────────────────────────────────────

export interface ScoredCandidate {
  candidateId: string;
  userId: string;
  profile: CandidateProfile;
  score: number;
  matchReasons: string[];
}
