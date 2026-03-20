/**
 * Seed script — idempotent.
 * Run: bun run lib/db/seed.ts
 *
 * Creates:
 *   - 4 seed employer users + company profiles
 *   - 25 realistic job roles across companies
 *   - 60 salary benchmark entries
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ─── Seed employers ───────────────────────────────────────────────────────────

const SEED_EMPLOYERS = [
  { email: "hiring@acme.io", companyName: "Acme Technologies" },
  { email: "hiring@lightspeed.co", companyName: "Lightspeed Labs" },
  { email: "hiring@meridian.com", companyName: "Meridian Health" },
  { email: "hiring@foundry.vc", companyName: "Foundry Capital" },
];

// ─── Seed roles ───────────────────────────────────────────────────────────────

const SEED_ROLES = [
  // Acme Technologies (index 0)
  {
    employerIndex: 0,
    title: "Senior Frontend Engineer",
    description: "Build the next generation of our customer-facing product in React. Own features end-to-end.",
    requirements: {
      skills: ["React", "TypeScript", "CSS", "Next.js", "GraphQL"],
      mustHave: ["React", "TypeScript"],
      minYearsExperience: 4,
      level: "senior",
      location: "San Francisco",
      remote: true,
      salaryMin: 160000,
      salaryMax: 210000,
    },
  },
  {
    employerIndex: 0,
    title: "Staff Software Engineer",
    description: "Drive technical direction across multiple product areas. Mentor a team of 8 engineers.",
    requirements: {
      skills: ["Python", "TypeScript", "System Design", "AWS", "PostgreSQL"],
      mustHave: ["Python", "System Design"],
      minYearsExperience: 8,
      level: "staff",
      location: "San Francisco",
      remote: false,
      salaryMin: 230000,
      salaryMax: 290000,
    },
  },
  {
    employerIndex: 0,
    title: "Product Manager — Growth",
    description: "Own the growth funnel from acquisition through activation. Data-driven and user-obsessed.",
    requirements: {
      skills: ["Product Management", "A/B Testing", "SQL", "Analytics", "Growth"],
      mustHave: ["Product Management"],
      minYearsExperience: 3,
      level: "mid",
      location: "San Francisco",
      remote: true,
      salaryMin: 150000,
      salaryMax: 190000,
    },
  },
  {
    employerIndex: 0,
    title: "ML Engineer",
    description: "Build and deploy recommendation systems and search ranking models at scale.",
    requirements: {
      skills: ["Python", "PyTorch", "Machine Learning", "SQL", "Spark"],
      mustHave: ["Python", "Machine Learning"],
      minYearsExperience: 3,
      level: "mid",
      location: "San Francisco",
      remote: true,
      salaryMin: 170000,
      salaryMax: 220000,
    },
  },
  {
    employerIndex: 0,
    title: "Design Systems Engineer",
    description: "Build and maintain our component library used by 30+ engineers. Bridge design and eng.",
    requirements: {
      skills: ["React", "TypeScript", "CSS", "Storybook", "Figma"],
      mustHave: ["React", "CSS"],
      minYearsExperience: 3,
      level: "mid",
      location: "Remote",
      remote: true,
      salaryMin: 140000,
      salaryMax: 180000,
    },
  },

  // Lightspeed Labs (index 1)
  {
    employerIndex: 1,
    title: "Backend Engineer — Infrastructure",
    description: "Scale our data pipeline to 10B events/day. Own the reliability of our core platform.",
    requirements: {
      skills: ["Go", "Kubernetes", "Kafka", "PostgreSQL", "AWS"],
      mustHave: ["Go", "Kubernetes"],
      minYearsExperience: 4,
      level: "senior",
      location: "New York",
      remote: false,
      salaryMin: 170000,
      salaryMax: 220000,
    },
  },
  {
    employerIndex: 1,
    title: "Senior Product Designer",
    description: "Define the visual language for our B2B SaaS product. Work directly with the CEO.",
    requirements: {
      skills: ["Figma", "Product Design", "UX Research", "Prototyping"],
      mustHave: ["Figma", "Product Design"],
      minYearsExperience: 5,
      level: "senior",
      location: "New York",
      remote: true,
      salaryMin: 145000,
      salaryMax: 180000,
    },
  },
  {
    employerIndex: 1,
    title: "Data Engineer",
    description: "Build the data infrastructure that powers product analytics and ML features.",
    requirements: {
      skills: ["Python", "dbt", "SQL", "Snowflake", "Airflow"],
      mustHave: ["Python", "SQL"],
      minYearsExperience: 3,
      level: "mid",
      location: "New York",
      remote: true,
      salaryMin: 140000,
      salaryMax: 175000,
    },
  },
  {
    employerIndex: 1,
    title: "Engineering Manager",
    description: "Lead a team of 6 backend engineers. You still write code — we don't hire pure managers.",
    requirements: {
      skills: ["Python", "Go", "Engineering Management", "System Design"],
      mustHave: ["Engineering Management"],
      minYearsExperience: 6,
      level: "manager",
      location: "New York",
      remote: false,
      salaryMin: 210000,
      salaryMax: 260000,
    },
  },
  {
    employerIndex: 1,
    title: "AI/LLM Engineer",
    description: "Build LLM-powered features for our developer tools platform. We ship fast.",
    requirements: {
      skills: ["Python", "LLMs", "Prompt Engineering", "FastAPI", "TypeScript"],
      mustHave: ["Python", "LLMs"],
      minYearsExperience: 2,
      level: "mid",
      location: "Remote",
      remote: true,
      salaryMin: 155000,
      salaryMax: 200000,
    },
  },
  {
    employerIndex: 1,
    title: "Technical Recruiter",
    description: "Own full-cycle recruiting for engineering. Build our candidate pipeline from scratch.",
    requirements: {
      skills: ["Technical Recruiting", "Sourcing", "Interviewing"],
      mustHave: ["Technical Recruiting"],
      minYearsExperience: 3,
      level: "mid",
      location: "New York",
      remote: true,
      salaryMin: 95000,
      salaryMax: 130000,
    },
  },

  // Meridian Health (index 2)
  {
    employerIndex: 2,
    title: "Full Stack Engineer — Patient Portal",
    description: "Build tools that help patients manage their care. HIPAA compliance is a hard requirement.",
    requirements: {
      skills: ["React", "Node.js", "TypeScript", "PostgreSQL", "HIPAA"],
      mustHave: ["React", "Node.js"],
      minYearsExperience: 3,
      level: "mid",
      location: "Boston",
      remote: true,
      salaryMin: 135000,
      salaryMax: 170000,
    },
  },
  {
    employerIndex: 2,
    title: "Data Scientist — Clinical",
    description: "Build predictive models for patient outcomes. Work with real clinical data.",
    requirements: {
      skills: ["Python", "Statistics", "Machine Learning", "SQL", "R"],
      mustHave: ["Python", "Statistics"],
      minYearsExperience: 3,
      level: "mid",
      location: "Boston",
      remote: false,
      salaryMin: 130000,
      salaryMax: 160000,
    },
  },
  {
    employerIndex: 2,
    title: "Senior iOS Engineer",
    description: "Build our patient-facing mobile app used by 500k patients. High quality bar.",
    requirements: {
      skills: ["Swift", "iOS", "UIKit", "SwiftUI", "Core Data"],
      mustHave: ["Swift", "iOS"],
      minYearsExperience: 5,
      level: "senior",
      location: "Remote",
      remote: true,
      salaryMin: 160000,
      salaryMax: 200000,
    },
  },
  {
    employerIndex: 2,
    title: "DevOps Engineer",
    description: "Own our cloud infrastructure on AWS. Zero-downtime deployments for healthcare applications.",
    requirements: {
      skills: ["AWS", "Terraform", "Kubernetes", "CI/CD", "Python"],
      mustHave: ["AWS", "Terraform"],
      minYearsExperience: 4,
      level: "senior",
      location: "Remote",
      remote: true,
      salaryMin: 150000,
      salaryMax: 190000,
    },
  },

  // Foundry Capital (index 3)
  {
    employerIndex: 3,
    title: "Software Engineer — Platform",
    description: "Build internal tools for our investment team. Own projects end-to-end as a founding engineer.",
    requirements: {
      skills: ["Python", "TypeScript", "React", "PostgreSQL", "APIs"],
      mustHave: ["Python", "TypeScript"],
      minYearsExperience: 2,
      level: "mid",
      location: "Chicago",
      remote: true,
      salaryMin: 130000,
      salaryMax: 165000,
    },
  },
  {
    employerIndex: 3,
    title: "Quantitative Analyst",
    description: "Build models to evaluate portfolio companies. Strong Python and statistics required.",
    requirements: {
      skills: ["Python", "Statistics", "Financial Modeling", "SQL", "Excel"],
      mustHave: ["Python", "Statistics"],
      minYearsExperience: 2,
      level: "junior",
      location: "Chicago",
      remote: false,
      salaryMin: 110000,
      salaryMax: 145000,
    },
  },
  {
    employerIndex: 3,
    title: "Principal Engineer",
    description: "Define technical strategy for our portfolio companies. Part advisory, part hands-on.",
    requirements: {
      skills: ["System Design", "Python", "Go", "TypeScript", "Architecture"],
      mustHave: ["System Design"],
      minYearsExperience: 12,
      level: "principal",
      location: "Remote",
      remote: true,
      salaryMin: 270000,
      salaryMax: 340000,
    },
  },
  {
    employerIndex: 3,
    title: "Product Designer — Consumer",
    description: "Shape the visual direction of 3 consumer apps in our portfolio. High autonomy role.",
    requirements: {
      skills: ["Figma", "Product Design", "User Research", "Motion Design"],
      mustHave: ["Figma", "Product Design"],
      minYearsExperience: 4,
      level: "senior",
      location: "Remote",
      remote: true,
      salaryMin: 140000,
      salaryMax: 175000,
    },
  },
  {
    employerIndex: 3,
    title: "Backend Engineer — APIs",
    description: "Build the APIs that connect our portfolio companies. REST and GraphQL expertise needed.",
    requirements: {
      skills: ["Python", "GraphQL", "REST", "PostgreSQL", "Redis"],
      mustHave: ["Python", "PostgreSQL"],
      minYearsExperience: 3,
      level: "mid",
      location: "Remote",
      remote: true,
      salaryMin: 140000,
      salaryMax: 175000,
    },
  },
  {
    employerIndex: 3,
    title: "Android Engineer",
    description: "Build our investor relations mobile app. Kotlin experience required.",
    requirements: {
      skills: ["Android", "Kotlin", "Jetpack Compose", "REST", "MVVM"],
      mustHave: ["Android", "Kotlin"],
      minYearsExperience: 3,
      level: "mid",
      location: "Remote",
      remote: true,
      salaryMin: 135000,
      salaryMax: 170000,
    },
  },
  {
    employerIndex: 0,
    title: "Security Engineer",
    description: "Own application and infrastructure security. Run threat modelling and penetration testing.",
    requirements: {
      skills: ["Security", "Python", "AWS", "Penetration Testing", "SIEM"],
      mustHave: ["Security"],
      minYearsExperience: 4,
      level: "senior",
      location: "Remote",
      remote: true,
      salaryMin: 170000,
      salaryMax: 215000,
    },
  },
  {
    employerIndex: 1,
    title: "Developer Advocate",
    description: "Speak at conferences, write tutorials, engage our developer community. Technical background essential.",
    requirements: {
      skills: ["Python", "TypeScript", "Technical Writing", "Public Speaking"],
      mustHave: ["Technical Writing"],
      minYearsExperience: 3,
      level: "mid",
      location: "Remote",
      remote: true,
      salaryMin: 120000,
      salaryMax: 155000,
    },
  },
  {
    employerIndex: 2,
    title: "Engineering Manager — Mobile",
    description: "Lead our iOS and Android teams. High empathy, strong technical background required.",
    requirements: {
      skills: ["Engineering Management", "iOS", "Android", "System Design"],
      mustHave: ["Engineering Management"],
      minYearsExperience: 6,
      level: "manager",
      location: "Boston",
      remote: false,
      salaryMin: 200000,
      salaryMax: 250000,
    },
  },
];

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

  // 1. Seed salary benchmarks (idempotent — skip if already present)
  const existing = await db.select({ id: schema.salaryBenchmarks.id }).from(schema.salaryBenchmarks).limit(1);
  if (existing.length === 0) {
    console.log(`Inserting ${SALARY_BENCHMARKS.length} salary benchmarks...`);
    await db.insert(schema.salaryBenchmarks).values(SALARY_BENCHMARKS);
    console.log("✓ Salary benchmarks inserted");
  } else {
    console.log("✓ Salary benchmarks already present, skipping");
  }

  // 2. Seed employer users + companies + roles
  const employerIds: string[] = [];

  for (const emp of SEED_EMPLOYERS) {
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, emp.email))
      .limit(1);

    if (!user) {
      // Dummy password hash — seed employers are not meant to log in
      const [created] = await db
        .insert(schema.users)
        .values({
          email: emp.email,
          type: "employer",
          image: "hash:seed_not_for_login",
        })
        .returning();
      user = created!;
      console.log(`✓ Created user: ${emp.email}`);
    }

    let [employer] = await db
      .select()
      .from(schema.employers)
      .where(eq(schema.employers.userId, user.id))
      .limit(1);

    if (!employer) {
      const [created] = await db
        .insert(schema.employers)
        .values({ userId: user.id, companyName: emp.companyName })
        .returning();
      employer = created!;
      console.log(`✓ Created employer: ${emp.companyName}`);
    }

    employerIds.push(employer.id);
  }

  // 3. Insert roles (skip if title already exists for that employer)
  let rolesInserted = 0;
  for (const roleData of SEED_ROLES) {
    const employerId = employerIds[roleData.employerIndex];
    if (!employerId) continue;

    const [existingRole] = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.employerId, employerId))
      .limit(1)
      .then((rows) => rows.filter((r) => r.title === roleData.title));

    if (!existingRole) {
      await db.insert(schema.roles).values({
        employerId,
        title: roleData.title,
        description: roleData.description,
        requirements: JSON.stringify(roleData.requirements),
      });
      rolesInserted++;
    }
  }

  console.log(`✓ ${rolesInserted} new roles inserted (${SEED_ROLES.length - rolesInserted} already existed)`);
  console.log("\n✅ Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
