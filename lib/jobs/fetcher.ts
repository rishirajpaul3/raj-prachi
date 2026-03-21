/**
 * Job fetcher — pulls listings from free public APIs and normalizes them.
 * Sources: Remotive, Arbeitnow, We Work Remotely (RSS), HN Jobs (Firebase).
 * Upserts with (source, external_id) deduplication.
 */

import { XMLParser } from "fast-xml-parser";
import { db } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import { and, eq, sql, lt, isNotNull, isNull } from "drizzle-orm";
import { embedBatch, jobEmbedText } from "@/lib/embeddings/huggingface";

interface NormalizedJob {
  externalId: string;
  source: string;
  title: string;
  companyName: string;
  description: string;
  applyUrl: string;
  logoUrl: string | null;
  isRemote: boolean;
  location: string;
  tags: string[];
}

// ─── Remotive ─────────────────────────────────────────────────────────────────

async function fetchRemotive(): Promise<NormalizedJob[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs?limit=50", {
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    jobs: Array<{
      id: number;
      title: string;
      company_name: string;
      description: string;
      url: string;
      company_logo: string;
      tags: string[];
      candidate_required_location: string;
    }>;
  };

  return (data.jobs ?? []).map((j) => ({
    externalId: String(j.id),
    source: "remotive",
    title: j.title,
    companyName: j.company_name,
    description: stripHtml(j.description).slice(0, 2000),
    applyUrl: j.url,
    logoUrl: j.company_logo || null,
    isRemote: true,
    location: j.candidate_required_location || "Remote",
    tags: j.tags ?? [],
  }));
}

// ─── Arbeitnow ────────────────────────────────────────────────────────────────

async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    data: Array<{
      slug: string;
      title: string;
      company_name: string;
      description: string;
      url: string;
      remote: boolean;
      location: string;
      tags: string[];
    }>;
  };

  return (data.data ?? []).map((j) => ({
    externalId: j.slug,
    source: "arbeitnow",
    title: j.title,
    companyName: j.company_name,
    description: stripHtml(j.description).slice(0, 2000),
    applyUrl: j.url,
    logoUrl: null,
    isRemote: j.remote,
    location: j.location || (j.remote ? "Remote" : ""),
    tags: j.tags ?? [],
  }));
}

// ─── We Work Remotely (RSS) ───────────────────────────────────────────────────

async function fetchWeWorkRemotely(): Promise<NormalizedJob[]> {
  const res = await fetch(
    "https://weworkremotely.com/remote-jobs.rss",
    { next: { revalidate: 0 } }
  );
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    htmlEntities: false,
    processEntities: false,
  });
  const parsed = parser.parse(xml) as {
    rss?: {
      channel?: {
        item?: Array<{
          title?: string;
          link?: string;
          description?: string;
          "dc:company"?: string;
          guid?: string | { "#text": string };
          enclosure?: { "@_url"?: string };
        }>;
      };
    };
  };

  const items = parsed?.rss?.channel?.item ?? [];

  return items
    .map((item) => {
      const guid =
        typeof item.guid === "string"
          ? item.guid
          : item.guid?.["#text"] ?? item.link ?? "";
      // Extract company from title "Company: Role Title" pattern
      const rawTitle = item.title ?? "";
      const colonIdx = rawTitle.indexOf(":");
      const companyName =
        colonIdx > 0 ? rawTitle.slice(0, colonIdx).trim() : "Company";
      const jobTitle =
        colonIdx > 0 ? rawTitle.slice(colonIdx + 1).trim() : rawTitle;

      return {
        externalId: guid,
        source: "wwr",
        title: jobTitle,
        companyName,
        description: stripHtml(item.description ?? "").slice(0, 2000),
        applyUrl: item.link ?? guid,
        logoUrl: item.enclosure?.["@_url"] ?? null,
        isRemote: true,
        location: "Remote",
        tags: [],
      };
    })
    .filter((j) => j.externalId && j.title);
}

// ─── HN Jobs (news.ycombinator.com/jobs HTML scraper) ────────────────────────
// Replaces the Firebase REST approach (50 individual calls) with a single
// paginated HTML fetch. Same source key "hn" so existing DB rows just update.

async function fetchHNJobs(): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = [];
  // Each page carries up to 30 items; follow "More" links until there are none
  let url: string | null = "https://news.ycombinator.com/jobs";

  while (url) {
    const res: Response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) break;

    const html: string = await res.text();

    // Extract all job rows: id from the athing tr, href+title from titleline anchor
    // Pattern matches <tr class="athing submission" id="ID"> … <a href="URL">TITLE</a>
    const rowRe =
      /<tr class="athing submission" id="(\d+)"[\s\S]*?<span class="titleline"><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html)) !== null) {
      const [, id, href, rawTitle] = m;
      // Decode HTML entities in title (&amp; → &, &#x2F; → /, etc.)
      const title = decodeHtmlEntities(rawTitle);
      // Derive company name: titles often read "Company (YC XX) is hiring …"
      const companyName = extractYCCompany(title);
      const applyUrl = href.startsWith("http")
        ? href
        : `https://news.ycombinator.com/${href}`;

      jobs.push({
        externalId: id,
        source: "hn",
        title,
        companyName,
        description: "",
        applyUrl,
        logoUrl: null,
        isRemote: /remote/i.test(title),
        location: "Various",
        tags: [],
      });
    }

    // Follow "More" pagination link if present
    const moreMatch: RegExpMatchArray | null = html.match(/href='(jobs\?next=\d+&amp;n=\d+)'/);
    if (moreMatch?.[1]) {
      url = `https://news.ycombinator.com/${moreMatch[1].replace(/&amp;/g, "&")}`;
    } else {
      url = null;
    }
  }

  return jobs;
}

// ─── Work at a Startup — YC job board (workatastartup.com/jobs) ───────────────
// WAAS renders via InertiaJS: the initial page load embeds all job data as JSON
// in the data-page attribute of <div id="app">. 30 curated listings per load.

async function fetchWAASJobs(): Promise<NormalizedJob[]> {
  const res = await fetch("https://www.workatastartup.com/jobs", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];

  const html = await res.text();

  // Inertia embeds props as HTML-entity-encoded JSON in data-page attribute
  const match = html.match(/data-page="([^"]+)"/);
  if (!match?.[1]) return [];

  let pageData: {
    props?: {
      jobs?: Array<{
        id: number;
        title: string;
        jobType?: string;
        location?: string;
        roleType?: string;
        companyName?: string;
        companyBatch?: string;
        companyOneLiner?: string;
        companyLogoUrl?: string;
        applyUrl?: string;
      }>;
    };
  };

  try {
    pageData = JSON.parse(decodeHtmlEntities(match[1]));
  } catch {
    return [];
  }

  const waasJobs = pageData?.props?.jobs ?? [];

  return waasJobs
    .filter((j) => j.id && j.title)
    .map((j) => {
      // WAAS applyUrl goes through YC auth; derive a direct link as fallback
      const directUrl = `https://www.workatastartup.com/jobs/${j.id}`;
      // The auth URL eventually lands on the WAAS job page — use it as the apply URL
      const applyUrl = j.applyUrl
        ? `https://www.workatastartup.com/jobs/${j.id}`
        : directUrl;

      const batch = j.companyBatch ? ` (YC ${j.companyBatch})` : "";
      const description = j.companyOneLiner
        ? `${j.companyName}${batch}: ${j.companyOneLiner}`
        : "";

      return {
        externalId: String(j.id),
        source: "yc_waas",
        title: j.title,
        companyName: j.companyName ?? "YC Startup",
        description,
        applyUrl,
        logoUrl: j.companyLogoUrl ?? null,
        isRemote:
          /remote/i.test(j.location ?? "") || /remote/i.test(j.jobType ?? ""),
        location: j.location ?? "Various",
        tags: j.roleType ? [j.roleType] : [],
      };
    });
}

// ─── Upsert logic ─────────────────────────────────────────────────────────────

async function upsertJob(job: NormalizedJob): Promise<void> {
  const requirements = JSON.stringify({
    skills: job.tags,
    remote: job.isRemote,
    location: job.location,
  });

  // Check if exists
  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.source, job.source),
        eq(roles.externalId, job.externalId)
      )
    )
    .limit(1);

  if (existing) {
    // Refresh title/description/applyUrl in case they changed
    await db
      .update(roles)
      .set({
        title: job.title,
        companyName: job.companyName,
        description: job.description,
        applyUrl: job.applyUrl,
        logoUrl: job.logoUrl,
        requirements,
        isActive: true,
      })
      .where(eq(roles.id, existing.id));
  } else {
    await db.insert(roles).values({
      externalId: job.externalId,
      source: job.source,
      title: job.title,
      companyName: job.companyName,
      description: job.description,
      applyUrl: job.applyUrl,
      logoUrl: job.logoUrl,
      requirements,
      isActive: true,
    });
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function refreshJobs(): Promise<{
  fetched: number;
  upserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let allJobs: NormalizedJob[] = [];

  const results = await Promise.allSettled([
    fetchRemotive(),
    fetchArbeitnow(),
    fetchWeWorkRemotely(),
    fetchHNJobs(),
    fetchWAASJobs(),
  ]);

  const labels = ["remotive", "arbeitnow", "wwr", "hn", "yc_waas"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      allJobs = allJobs.concat(r.value);
    } else {
      errors.push(`${labels[i]}: ${String(r.reason)}`);
    }
  });

  // Deduplicate within the batch by (source, externalId)
  const seen = new Set<string>();
  const unique = allJobs.filter((j) => {
    const key = `${j.source}:${j.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let upserted = 0;
  for (const job of unique) {
    try {
      await upsertJob(job);
      upserted++;
    } catch (e) {
      errors.push(`upsert ${job.source}:${job.externalId}: ${String(e)}`);
    }
  }

  // Mark stale jobs (not seen in this fetch) as inactive
  // We only deactivate source-tracked jobs older than 7 days not in this batch
  const activeExternalIds = unique.map((j) => j.externalId);
  if (activeExternalIds.length > 0) {
    await db
      .update(roles)
      .set({ isActive: false })
      .where(
        sql`source IS NOT NULL AND external_id IS NOT NULL AND external_id NOT IN (${sql.join(
          activeExternalIds.map((id) => sql`${id}`),
          sql`, `
        )}) AND created_at < NOW() - INTERVAL '7 days'`
      );
  }

  // Hard age cutoff — any external listing older than 30 days is considered expired
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db
    .update(roles)
    .set({ isActive: false })
    .where(
      and(
        isNotNull(roles.source),
        lt(roles.createdAt, thirtyDaysAgo),
        eq(roles.isActive, true)
      )
    );

  // Spot-check apply URLs for listings that are 14–30 days old.
  // Samples up to 20 at a time; marks 404s inactive immediately.
  const urlCheckErrors = await spotCheckUrls();
  errors.push(...urlCheckErrors);

  // Generate embeddings for active jobs that don't have one yet.
  // Capped at 200 per run to stay well within HuggingFace free-tier rate limits
  // (~1000 req/hour; 200 jobs in 4 batches of 50 ≈ 4 API calls).
  const embeddingErrors = await generateMissingJobEmbeddings(200);
  errors.push(...embeddingErrors);

  return { fetched: allJobs.length, upserted, errors };
}

// ─── Embedding generator ──────────────────────────────────────────────────────
// Generates sentence embeddings for active jobs that don't have one yet.
// Batches 50 texts per API call to minimise HuggingFace request count.

async function generateMissingJobEmbeddings(limit: number): Promise<string[]> {
  if (!process.env.HUGGINGFACE_API_TOKEN) {
    return []; // Silently skip if token not configured — app falls back to keyword matching
  }

  const unembedded = await db
    .select({ id: roles.id, title: roles.title, description: roles.description })
    .from(roles)
    .where(and(eq(roles.isActive, true), isNull(roles.jobEmbedding)))
    .limit(limit);

  if (unembedded.length === 0) return [];

  const errors: string[] = [];
  const BATCH = 50;

  for (let i = 0; i < unembedded.length; i += BATCH) {
    const batch = unembedded.slice(i, i + BATCH);
    try {
      const texts = batch.map((j) => jobEmbedText(j.title, j.description));
      const embeddings = await embedBatch(texts);

      // Persist each embedding; individual failures don't abort the loop
      for (let k = 0; k < batch.length; k++) {
        try {
          await db
            .update(roles)
            .set({ jobEmbedding: embeddings[k], embeddingUpdatedAt: new Date() })
            .where(eq(roles.id, batch[k].id));
        } catch (e) {
          errors.push(`embed-write ${batch[k].id}: ${String(e)}`);
        }
      }
    } catch (e) {
      errors.push(`embed-batch ${i}: ${String(e)}`);
    }

    // Brief pause between batches — keeps well within free-tier rate limits
    if (i + BATCH < unembedded.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return errors;
}

// ─── URL spot-checker ─────────────────────────────────────────────────────────
// HEAD-checks a sample of active listings that are 14–30 days old.
// Marks 404s as inactive so users never encounter dead apply links.

async function spotCheckUrls(): Promise<string[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Grab up to 20 active external jobs in the 14–30 day window
  const candidates = await db
    .select({ id: roles.id, applyUrl: roles.applyUrl })
    .from(roles)
    .where(
      and(
        isNotNull(roles.source),
        isNotNull(roles.applyUrl),
        eq(roles.isActive, true),
        lt(roles.createdAt, fourteenDaysAgo),
        // Exclude already-expired ones (handled by age cutoff above)
        sql`${roles.createdAt} > ${thirtyDaysAgo}`
      )
    )
    .limit(20);

  if (candidates.length === 0) return [];

  const errors: string[] = [];

  // Check all in parallel — each with a 5s abort timeout
  await Promise.allSettled(
    candidates.map(async (row) => {
      if (!row.applyUrl) return;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(row.applyUrl, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; jobcheck/1.0)" },
        });
        clearTimeout(timeout);
        if (res.status === 404) {
          await db.update(roles).set({ isActive: false }).where(eq(roles.id, row.id));
        }
      } catch {
        // Timeout or network error — leave active; user-facing check will catch it
      }
    })
  );

  return errors;
}

// ─── Util ─────────────────────────────────────────────────────────────────────

/** Decode common HTML entities in scraped text */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&#x3D;/g, "=");
}

/**
 * Extract company name from HN jobs page title patterns:
 * "Acme (YC W25) is hiring …"  → "Acme"
 * "Acme (YC W25): Software Engineer" → "Acme"
 */
function extractYCCompany(title: string): string {
  // Match "CompanyName (YC XX)" at the start
  const ycMatch = title.match(/^(.+?)\s*\(YC\s+[A-Z]\d+\)/i);
  if (ycMatch?.[1]) return ycMatch[1].trim();
  // Fallback: take text before " is hiring" or ":"
  const hiringMatch = title.match(/^(.+?)\s+(?:is hiring|–|-)/i);
  if (hiringMatch?.[1]) return hiringMatch[1].trim();
  return title.split(":")[0].trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
