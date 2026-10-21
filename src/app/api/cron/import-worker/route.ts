import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImportBatch } from "@/lib/import-service";

export const maxDuration = 60; // 60 seconds for safety-net cron worker

/**
 * GET /api/cron/import-worker
 *
 * Background safety net cron for processing stalled or ongoing import jobs.
 * Protected by Authorization: Bearer CRON_SECRET.
 * Identifies oldest pending/processing jobs with pending or stale-processing items
 * and runs processImportBatch on each.
 */
export async function GET(req: NextRequest) {
  // 1. Authorization check
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET is missing or empty" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database admin client unavailable" },
      { status: 500 }
    );
  }

  try {
    // 2. Find jobs with status pending or processing (oldest first, limited to a few jobs)
    const { data: candidateJobs, error: jobsErr } = await admin
      .from("import_jobs")
      .select("id, status, created_at")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(5);

    if (jobsErr) {
      console.error("Cron import-worker: failed to fetch candidate jobs:", jobsErr);
      return NextResponse.json({ error: jobsErr.message }, { status: 500 });
    }

    if (!candidateJobs || candidateJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active import jobs found",
        processed: [],
      });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const processedSummaries: Array<{
      jobId: string;
      status: string;
      remaining: number;
      processedBatchSize: number;
    }> = [];

    // 3. Process each job that has pending or stale-processing items
    for (const job of candidateJobs) {
      const { count: pendingOrStuckCount } = await admin
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .or(`status.eq.pending,and(status.eq.processing,or(claimed_at.is.null,claimed_at.lt.${twoMinutesAgo}))`);

      if (pendingOrStuckCount && pendingOrStuckCount > 0) {
        const batchResult = await processImportBatch(job.id);
        processedSummaries.push({
          jobId: job.id,
          status: batchResult.status,
          remaining: batchResult.remaining,
          processedBatchSize: batchResult.processedBatchSize,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: processedSummaries.length,
      jobs: processedSummaries,
    });
  } catch (err: unknown) {
    console.error("Cron import-worker execution error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Worker error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
