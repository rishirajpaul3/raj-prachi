import { NextRequest, NextResponse } from "next/server";
import { refreshJobs } from "@/lib/jobs/fetcher";

export const maxDuration = 60; // Vercel hobby max

export async function GET(req: NextRequest) {
  // Protect cron endpoint — Vercel sends this header; manual callers must match
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshJobs();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Job refresh failed:", err);
    return NextResponse.json(
      { error: "Job refresh failed", detail: String(err) },
      { status: 500 }
    );
  }
}
