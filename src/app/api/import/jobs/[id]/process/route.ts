import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processImportBatch } from "@/lib/import-service";

export const maxDuration = 60; // 60 seconds max invocation

/**
 * POST /api/import/jobs/[id]/process
 *
 * User-triggered import processing endpoint.
 * Authenticates user, verifies job ownership, processes one batch synchronously,
 * and if pending items remain, schedules subsequent batches in the background
 * via next/server after().
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await context.params;
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify job exists and belongs strictly to the signed-in user (404 for anyone else)
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("id, user_id, status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Import job not found" },
        { status: 404 }
      );
    }

    // 2. Run one batch
    const batchResult = await processImportBatch(jobId);

    // 3. If pending items remain and status is processing, schedule subsequent batches in background
    if (batchResult.remaining > 0 && batchResult.status === "processing") {
      after(async () => {
        const deadline = Date.now() + 45000; // Keep safely under maxDuration 60s
        while (Date.now() < deadline) {
          const next = await processImportBatch(jobId);
          if (
            next.status === "completed" ||
            next.status === "paused" ||
            next.status === "failed" ||
            next.remaining === 0
          ) {
            break;
          }
        }
      });
    }

    return NextResponse.json(batchResult);
  } catch (err: unknown) {
    console.error("POST /api/import/jobs/[id]/process error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
