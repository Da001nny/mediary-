import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/import/jobs
 * Returns active job (pending, processing, paused) or the latest job for the authenticated user.
 */
export async function GET() {
  try {
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

    // Check for active job first
    const { data: activeJobs } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "paused"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      return NextResponse.json({ activeJob: activeJobs[0] });
    }

    // Otherwise get the most recently updated job
    const { data: latestJobs } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    return NextResponse.json({
      activeJob: null,
      latestJob: latestJobs?.[0] || null,
    });
  } catch (err: unknown) {
    console.error("GET /api/import/jobs error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/import/jobs
 * Creates a new import job. Enforces 1 active job per user.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { source, options, total } = body;

    if (!source || (source !== "letterboxd" && source !== "goodreads")) {
      return NextResponse.json(
        { error: "Invalid import source. Must be 'letterboxd' or 'goodreads'." },
        { status: 400 }
      );
    }

    const totalCount = typeof total === "number" && total > 0 ? total : 0;
    if (totalCount > 5000) {
      return NextResponse.json(
        { error: "Import limit exceeded. Maximum 5,000 entries per job." },
        { status: 400 }
      );
    }

    // Enforce 1 active job per user
    const { data: existingActive } = await supabase
      .from("import_jobs")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "paused"])
      .limit(1);

    if (existingActive && existingActive.length > 0) {
      return NextResponse.json(
        {
          error: "You already have an active import job in progress.",
          activeJobId: existingActive[0].id,
        },
        { status: 409 }
      );
    }

    const { data: job, error: insertError } = await supabase
      .from("import_jobs")
      .insert({
        user_id: user.id,
        source,
        status: "pending",
        options: options || {},
        total: totalCount,
        matched: 0,
        already_logged: 0,
        needs_review: 0,
        failed: 0,
      })
      .select()
      .single();

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create import job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/import/jobs error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
