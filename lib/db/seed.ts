/**
 * Seed script — idempotent.
 * Run: bun run lib/db/seed.ts
 *
 * Seeds:
 *   - 60 salary benchmark entries (real job listings come from refreshJobs() cron)
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── Salary benchmarks ────────────────────────────────────────────────────────

const SALARY_BENCHMARKS = [
  // Software Engineer
  { role: "software engineer", level: "junior", location: "San Francisco", p25: 110000, p50: 130000, p75: 155000 },
  { role: "software engineer", level: "mid", location: "San Francisco", p25: 145000, p50: 175000, p75: 210000 },
  { role: "software engineer", level: "senior", location: "San Francisco", p25: 185000, p50: 220000, p75: 265000 },
  { role: "software engineer", level: "staff", location: "San Francisco", p25: 230000, p50: 270000, p75: 320000 },
  { role: "software engineer", level: "principal", location: "San Francisco", p25: 290000, p50: 340000, p75: 400000 },

  { role: "software engineer", level: "junior", location: "New York", p25: 100000, p50: 120000, p75: 145000 },
  { role: "software engineer", level: "mid", location: "New York", p25: 135000, p50: 162000, p75: 195000 },
  { role: "software engineer", level: "senior", location: "New York", p25: 175000, p50: 210000, p75: 250000 },
  { role: "software engineer", level: "staff", location: "New York", p25: 220000, p50: 255000, p75: 305000 },

  { role: "software engineer", level: "junior", location: "remote", p25: 90000, p50: 110000, p75: 135000 },
  { role: "software engineer", level: "mid", location: "remote", p25: 120000, p50: 145000, p75: 175000 },
  { role: "software engineer", level: "senior", location: "remote", p25: 155000, p50: 185000, p75: 225000 },
  { role: "software engineer", level: "staff", location: "remote", p25: 200000, p50: 240000, p75: 285000 },

  // Product Manager
  { role: "product manager", level: "junior", location: "San Francisco", p25: 100000, p50: 120000, p75: 145000 },
  { role: "product manager", level: "mid", location: "San Francisco", p25: 140000, p50: 165000, p75: 195000 },
  { role: "product manager", level: "senior", location: "San Francisco", p25: 175000, p50: 210000, p75: 250000 },
  { role: "product manager", level: "lead", location: "San Francisco", p25: 210000, p50: 250000, p75: 295000 },

  { role: "product manager", level: "mid", location: "New York", p25: 125000, p50: 150000, p75: 180000 },
  { role: "product manager", level: "senior", location: "New York", p25: 160000, p50: 195000, p75: 235000 },
  { role: "product manager", level: "mid", location: "remote", p25: 110000, p50: 135000, p75: 165000 },
  { role: "product manager", level: "senior", location: "remote", p25: 150000, p50: 180000, p75: 215000 },

  // Product Designer
  { role: "product designer", level: "junior", location: "San Francisco", p25: 90000, p50: 110000, p75: 135000 },
  { role: "product designer", level: "mid", location: "San Francisco", p25: 125000, p50: 150000, p75: 180000 },
  { role: "product designer", level: "senior", location: "San Francisco", p25: 160000, p50: 190000, p75: 225000 },
  { role: "product designer", level: "lead", location: "San Francisco", p25: 190000, p50: 225000, p75: 265000 },

  { role: "product designer", level: "mid", location: "New York", p25: 115000, p50: 138000, p75: 165000 },
  { role: "product designer", level: "senior", location: "New York", p25: 148000, p50: 175000, p75: 210000 },
  { role: "product designer", level: "mid", location: "remote", p25: 105000, p50: 128000, p75: 155000 },
  { role: "product designer", level: "senior", location: "remote", p25: 138000, p50: 165000, p75: 198000 },

  // ML Engineer
  { role: "ml engineer", level: "mid", location: "San Francisco", p25: 170000, p50: 210000, p75: 255000 },
  { role: "ml engineer", level: "senior", location: "San Francisco", p25: 220000, p50: 265000, p75: 315000 },
  { role: "ml engineer", level: "mid", location: "New York", p25: 158000, p50: 195000, p75: 235000 },
  { role: "ml engineer", level: "senior", location: "New York", p25: 205000, p50: 248000, p75: 295000 },
  { role: "ml engineer", level: "mid", location: "remote", p25: 145000, p50: 178000, p75: 215000 },
  { role: "ml engineer", level: "senior", location: "remote", p25: 185000, p50: 225000, p75: 270000 },

  // Data Engineer
  { role: "data engineer", level: "mid", location: "San Francisco", p25: 140000, p50: 168000, p75: 200000 },
  { role: "data engineer", level: "senior", location: "San Francisco", p25: 175000, p50: 210000, p75: 250000 },
  { role: "data engineer", level: "mid", location: "New York", p25: 130000, p50: 156000, p75: 188000 },
  { role: "data engineer", level: "mid", location: "remote", p25: 118000, p50: 142000, p75: 172000 },
  { role: "data engineer", level: "senior", location: "remote", p25: 152000, p50: 183000, p75: 220000 },

  // Data Scientist
  { role: "data scientist", level: "junior", location: "San Francisco", p25: 115000, p50: 138000, p75: 165000 },
  { role: "data scientist", level: "mid", location: "San Francisco", p25: 150000, p50: 180000, p75: 218000 },
  { role: "data scientist", level: "senior", location: "San Francisco", p25: 190000, p50: 228000, p75: 272000 },
  { role: "data scientist", level: "mid", location: "remote", p25: 130000, p50: 156000, p75: 188000 },

  // Engineering Manager
  { role: "engineering manager", level: "manager", location: "San Francisco", p25: 220000, p50: 265000, p75: 315000 },
  { role: "engineering manager", level: "manager", location: "New York", p25: 205000, p50: 248000, p75: 295000 },
  { role: "engineering manager", level: "manager", location: "remote", p25: 185000, p50: 225000, p75: 270000 },
  { role: "engineering manager", level: "senior", location: "San Francisco", p25: 235000, p50: 285000, p75: 340000 },

  // DevOps / SRE
  { role: "devops engineer", level: "mid", location: "San Francisco", p25: 145000, p50: 175000, p75: 212000 },
  { role: "devops engineer", level: "senior", location: "San Francisco", p25: 185000, p50: 222000, p75: 268000 },
  { role: "devops engineer", level: "mid", location: "remote", p25: 125000, p50: 152000, p75: 183000 },
  { role: "devops engineer", level: "senior", location: "remote", p25: 160000, p50: 192000, p75: 232000 },

  // iOS / Android
  { role: "ios engineer", level: "mid", location: "San Francisco", p25: 148000, p50: 178000, p75: 215000 },
  { role: "ios engineer", level: "senior", location: "San Francisco", p25: 185000, p50: 223000, p75: 268000 },
  { role: "ios engineer", level: "senior", location: "remote", p25: 158000, p50: 190000, p75: 230000 },
  { role: "android engineer", level: "mid", location: "remote", p25: 135000, p50: 162000, p75: 195000 },
  { role: "android engineer", level: "senior", location: "remote", p25: 158000, p50: 190000, p75: 228000 },
];

// ─── Main seed function ───────────────────────────────────────────────────────

async function seed() {
  console.log("Starting seed...");

  // Seed salary benchmarks (idempotent — skip if already present)
  const existing = await db
    .select({ id: schema.salaryBenchmarks.id })
    .from(schema.salaryBenchmarks)
    .limit(1);

  if (existing.length === 0) {
    console.log(`Inserting ${SALARY_BENCHMARKS.length} salary benchmarks...`);
    await db.insert(schema.salaryBenchmarks).values(SALARY_BENCHMARKS);
    console.log("✓ Salary benchmarks inserted");
  } else {
    console.log("✓ Salary benchmarks already present, skipping");
  }

  console.log("\n✅ Seed complete! Real job listings are fetched via /api/cron/refresh-jobs.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
