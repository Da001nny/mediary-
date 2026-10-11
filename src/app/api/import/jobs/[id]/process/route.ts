import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  matchImportItem,
  resolveImportPrivacy,
  UpstreamQuotaError,
} from "@/lib/import-service";
import type { ParsedImportItem } from "@/lib/import-parser";

/**
 * POST /api/import/jobs/[id]/process
 * Claims and processes the next up to 10 pending items in a job.
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

    // 1. Verify job exists and belongs to the user
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Import job not found or unauthorized" },
        { status: 404 }
      );
    }

    // If job was already marked completed, return current status
    if (job.status === "completed") {
      return NextResponse.json({
        success: true,
        status: "completed",
        remaining: 0,
        job,
      });
    }

    // Resolve user's chosen privacy setting
    const chosenPrivacyOpt = (job.options as Record<string, string>)?.privacy;
    const resolvedPrivacy = await resolveImportPrivacy(
      supabase,
      user.id,
      chosenPrivacyOpt
    );

    // 2. Atomically claim next 10 pending items
    // First try the RPC claim_import_items if available, else fallback to select + update
    let claimedItems: Array<{ id: string; row: unknown }> = [];

    const { data: rpcClaimed, error: rpcErr } = await supabase.rpc(
      "claim_import_items",
      {
        p_job_id: jobId,
        p_limit: 10,
      }
    );

    if (!rpcErr && Array.isArray(rpcClaimed)) {
      claimedItems = rpcClaimed;
    } else {
      // Fallback claim via standard PostgREST select & update (including items stuck in processing > 2 min)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: pendingRows } = await supabase
        .from("import_items")
        .select("id, row")
        .eq("job_id", jobId)
        .or(`status.eq.pending,and(status.eq.processing,or(claimed_at.is.null,claimed_at.lt.${twoMinutesAgo}))`)
        .order("created_at", { ascending: true })
        .limit(10);

      if (pendingRows && pendingRows.length > 0) {
        const itemIds = pendingRows.map((p) => p.id);
        await supabase
          .from("import_items")
          .update({
            status: "processing",
            claimed_at: new Date().toISOString(),
          })
          .in("id", itemIds);

        claimedItems = pendingRows;
      }
    }

    // If no pending items were claimed, check if any pending or stuck items remain
    if (claimedItems.length === 0) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { count: pendingCount } = await supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .or(`status.eq.pending,and(status.eq.processing,or(claimed_at.is.null,claimed_at.lt.${twoMinutesAgo}))`);

      if (!pendingCount || pendingCount === 0) {
        // Mark job as completed
        const { data: updatedJob } = await supabase
          .from("import_jobs")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .select()
          .single();

        return NextResponse.json({
          success: true,
          status: "completed",
          remaining: 0,
          job: updatedJob || job,
        });
      }

      return NextResponse.json({
        success: true,
        status: "processing",
        remaining: pendingCount,
        job,
      });
    }

    // 3. Process each claimed item
    let quotaHit = false;

    for (const item of claimedItems) {
      const row = item.row as unknown as ParsedImportItem;

      try {
        const match = await matchImportItem(row);

        if (match.status === "matched" && match.media_id) {
          // Check if already logged by user
          const { data: existingEntry } = await supabase
            .from("entries")
            .select("id")
            .eq("user_id", user.id)
            .eq("media_id", match.media_id)
            .maybeSingle();

          if (existingEntry) {
            // Already logged: Leave it alone, count as already_logged
            await supabase
              .from("import_items")
              .update({
                status: "already_logged",
                media_id: match.media_id,
              })
              .eq("id", item.id);
          } else {
            // Insert into entries without calling activity helpers
            const { error: insertEntryErr } = await supabase
              .from("entries")
              .insert({
                user_id: user.id,
                media_id: match.media_id,
                status: row.status,
                rating: row.rating,
                review: row.review,
                contains_spoilers: row.contains_spoilers,
                privacy: resolvedPrivacy,
                completed_at: row.completed_at || null,
                created_at: row.completed_at || new Date().toISOString(),
              });

            if (insertEntryErr) {
              console.warn("Failed to insert imported entry:", insertEntryErr);
              // If failed due to unique constraint or similar
              if (insertEntryErr.code === "23505") {
                await supabase
                  .from("import_items")
                  .update({
                    status: "already_logged",
                    media_id: match.media_id,
                  })
                  .eq("id", item.id);
              } else {
                await supabase
                  .from("import_items")
                  .update({
                    status: "failed",
                    error: insertEntryErr.message || "Could not create diary entry",
                  })
                  .eq("id", item.id);
              }
            } else {
              await supabase
                .from("import_items")
                .update({
                  status: "matched",
                  media_id: match.media_id,
                })
                .eq("id", item.id);
            }
          }
        } else if (match.status === "needs_review") {
          await supabase
            .from("import_items")
            .update({
              status: "needs_review",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              candidates: (match.candidates || []) as any,
            })
            .eq("id", item.id);
        } else {
          // Failed
          await supabase
            .from("import_items")
            .update({
              status: "failed",
              error: match.error || "Title not found in media catalog",
            })
            .eq("id", item.id);
        }
      } catch (err: unknown) {
        if (err instanceof UpstreamQuotaError) {
          quotaHit = true;
          // Revert this item back to pending
          await supabase
            .from("import_items")
            .update({ status: "pending" })
            .eq("id", item.id);
          break;
        }

        // Other non-quota errors: mark item as failed with friendly reason
        await supabase
          .from("import_items")
          .update({
            status: "failed",
            error: err instanceof Error ? err.message : "Processing error",
          })
          .eq("id", item.id);
      }
    }

    // 4. Recount job stats and update job status
    const [
      { count: matchedCount },
      { count: alreadyLoggedCount },
      { count: needsReviewCount },
      { count: failedCount },
      { count: remainingPendingCount },
    ] = await Promise.all([
      supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("status", "matched"),
      supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("status", "already_logged"),
      supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("status", "needs_review"),
      supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("status", "failed"),
      supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .in("status", ["pending", "processing"]),
    ]);

    const newJobStatus = quotaHit
      ? "paused"
      : (remainingPendingCount || 0) === 0
      ? "completed"
      : "processing";

    const { data: updatedJob } = await supabase
      .from("import_jobs")
      .update({
        matched: matchedCount || 0,
        already_logged: alreadyLoggedCount || 0,
        needs_review: needsReviewCount || 0,
        failed: failedCount || 0,
        status: newJobStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();

    if (quotaHit) {
      return NextResponse.json({
        success: true,
        status: "paused",
        reason: "quota_reached",
        message: "Quota reached on upstream provider. Please resume later.",
        remaining: remainingPendingCount || 0,
        job: updatedJob || job,
      });
    }

    return NextResponse.json({
      success: true,
      status: newJobStatus,
      processedBatchSize: claimedItems.length,
      remaining: remainingPendingCount || 0,
      job: updatedJob || job,
    });
  } catch (err: unknown) {
    console.error("POST /api/import/jobs/[id]/process error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
