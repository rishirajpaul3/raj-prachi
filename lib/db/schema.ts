import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userTypeEnum = pgEnum("user_type", ["seeker", "employer"]);
export const swipeDirectionEnum = pgEnum("swipe_direction", ["yes", "no"]);
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "tool",
]);
export const agentEnum = pgEnum("agent", ["raj", "prachi"]);

// ─── Auth.js required tables ──────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  type: userTypeEnum("type"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
    index("accounts_user_id_idx").on(account.userId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => [index("sessions_user_id_idx").on(session.userId)]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── Domain tables ────────────────────────────────────────────────────────────

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .unique()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Typed via CandidateProfile Zod schema in lib/types.ts
    profile: text("profile").default("{}").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("candidates_user_id_idx").on(t.userId)]
);

export const employers = pgTable(
  "employers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .unique()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("employers_user_id_idx").on(t.userId)]
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    // Typed via RoleRequirements Zod schema in lib/types.ts
    requirements: text("requirements").default("{}").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("roles_employer_id_idx").on(t.employerId)]
);

export const jobSwipes = pgTable(
  "job_swipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    direction: swipeDirectionEnum("direction").notNull(),
    // Raj's reasoning for why he picked this job for the candidate
    rajReason: text("raj_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    // Compound index for mutual match detection — this is the hot path
    index("job_swipes_candidate_role_idx").on(t.candidateId, t.roleId),
    index("job_swipes_candidate_id_idx").on(t.candidateId),
  ]
);

export const employerInterests = pgTable(
  "employer_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    // Compound index for mutual match detection — this is the hot path
    index("employer_interests_role_candidate_idx").on(t.roleId, t.candidateId),
    index("employer_interests_role_id_idx").on(t.roleId),
  ]
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    introText: text("intro_text"),
    matchedAt: timestamp("matched_at", { mode: "date" }).defaultNow().notNull(),
    // Guards against duplicate notifications — check this before creating notifications
    introSentAt: timestamp("intro_sent_at", { mode: "date" }),
  },
  (t) => [
    index("matches_candidate_id_idx").on(t.candidateId),
    index("matches_role_id_idx").on(t.roleId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    index("notifications_match_id_idx").on(t.matchId),
  ]
);

// ─── Conversations & Messages (normalized — no JSON blob) ─────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agent: agentEnum("agent").notNull(),
    // For interview sessions: links to the role being practiced
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    isInterviewSession: boolean("is_interview_session").default(false).notNull(),
    interviewComplete: boolean("interview_complete").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("conversations_user_id_agent_idx").on(t.userId, t.agent),
    index("conversations_user_id_idx").on(t.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // 'user' | 'assistant' | 'tool'
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    // For tool results: which tool was called and its use ID (for Claude's multi-turn format)
    toolName: text("tool_name"),
    toolUseId: text("tool_use_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("messages_conversation_id_idx").on(t.conversationId),
    // Most queries fetch recent messages in order
    index("messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt
    ),
  ]
);

// ─── Salary Benchmarks (seed data) ───────────────────────────────────────────

export const salaryBenchmarks = pgTable(
  "salary_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role").notNull(),
    level: text("level").notNull(),
    location: text("location").notNull(),
    p25: integer("p25").notNull(),
    p50: integer("p50").notNull(),
    p75: integer("p75").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("salary_benchmarks_role_level_loc_idx").on(t.role, t.level, t.location)]
);

// ─── Type exports (inferred from schema) ─────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Employer = typeof employers.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type JobSwipe = typeof jobSwipes.$inferSelect;
export type EmployerInterest = typeof employerInterests.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type SalaryBenchmark = typeof salaryBenchmarks.$inferSelect;
