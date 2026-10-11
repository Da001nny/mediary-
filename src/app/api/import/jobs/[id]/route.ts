import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/import/jobs/[id]
 * Returns import job details and items filtered by status.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await context.params;
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status"); // 'needs_review' | 'failed' | null

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

    // Query items if requested
    let itemsQuery = supabase
      .from("import_items")
      .select("*")
      .eq("job_id", jobId);

    if (filterStatus) {
      itemsQuery = itemsQuery.eq("status", filterStatus);
    }

    const { data: items } = await itemsQuery.order("created_at", { ascending: true }).limit(500);

    return NextResponse.json({
      success: true,
      job,
      items: items || [],
    });
  } catch (err: unknown) {
    console.error("GET /api/import/jobs/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
