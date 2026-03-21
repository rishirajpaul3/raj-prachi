/**
 * One-time migration: enable pgvector on Neon and add embedding columns.
 * Run once with: bun run db:migrate-vectors
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("1/4  Enabling pgvector extension...");
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  console.log("2/4  Adding job_embedding + embedding_updated_at to roles...");
  await sql`
    ALTER TABLE roles
      ADD COLUMN IF NOT EXISTS job_embedding vector(384),
      ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp
  `;

  console.log("3/4  Adding profile_embedding + embedding_updated_at to candidates...");
  await sql`
    ALTER TABLE candidates
      ADD COLUMN IF NOT EXISTS profile_embedding vector(384),
      ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp
  `;

  console.log("4/4  Creating HNSW index for approximate nearest-neighbor search...");
  // HNSW is faster than IVFFlat for < 1M rows and doesn't need training
  await sql`
    CREATE INDEX IF NOT EXISTS roles_job_embedding_hnsw_idx
      ON roles USING hnsw (job_embedding vector_cosine_ops)
  `;

  console.log("\nDone! Vector columns and index are ready.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
