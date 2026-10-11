import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/import/jobs/[id]/cancel
 * Cancels or clears an active job so user can start over.
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

    // Verify ownership
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Import job not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete job (cascades to import_items)
    await supabase.from("import_jobs").delete().eq("id", jobId);

    return NextResponse.json({ success: true, message: "Import job cancelled." });
  } catch (err: unknown) {
    console.error("POST /api/import/jobs/[id]/cancel error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
