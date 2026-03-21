/**
 * Hugging Face Inference API — sentence-transformers/all-MiniLM-L6-v2
 * Free tier: ~1000 req/hour. Outputs 384-dim unit-normalized vectors.
 * Cosine similarity on unit vectors = dot product.
 */

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

/** Embed a batch of texts. Returns one 384-dim embedding per input. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) throw new Error("HUGGINGFACE_API_TOKEN not configured");

  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: texts,
      options: { wait_for_model: true },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HuggingFace API ${res.status}: ${body.slice(0, 300)}`);
  }

  return (await res.json()) as number[][];
}

/** Embed a single text. */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text]);
  return embedding;
}

// ─── Text builders ─────────────────────────────────────────────────────────────

/** Builds the embedding input text for a job listing. */
export function jobEmbedText(title: string, description: string): string {
  return `${title}. ${description.slice(0, 500)}`.trim();
}

/** Builds the embedding input text for a candidate profile. */
export function profileEmbedText(profile: {
  currentTitle?: string;
  skills?: string[];
  industries?: string[];
  careerGoals?: string;
  summary?: string;
}): string {
  const parts: string[] = [];
  if (profile.currentTitle) parts.push(profile.currentTitle);
  if (profile.skills?.length) parts.push(profile.skills.join(", "));
  if (profile.industries?.length) parts.push(profile.industries.join(", "));
  if (profile.careerGoals) parts.push(profile.careerGoals);
  if (profile.summary) parts.push(profile.summary);
  return parts.join(". ").trim();
}

// ─── Similarity math ──────────────────────────────────────────────────────────

/**
 * Dot product of two unit-normalized vectors = cosine similarity.
 * all-MiniLM-L6-v2 always outputs unit-length vectors, so this is exact.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Converts cosine similarity to a 0–100 match percentage.
 * Calibrated for all-MiniLM-L6-v2:
 *   sim ≤ 0.20  →  0%   (unrelated)
 *   sim = 0.50  →  50%  (somewhat relevant)
 *   sim ≥ 0.80  → 100%  (strong match)
 */
export function similarityToScore(sim: number): number {
  return Math.round(Math.max(0, Math.min(100, ((sim - 0.2) / 0.6) * 100)));
}

/** Parses a pgvector string "[0.1,0.2,...]" into a number array. */
export function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return null;
    }
  }
  return null;
}
