import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParsedImportItem } from "@/lib/import-parser";

/**
 * POST /api/import/jobs/[id]/items
 * Uploads a chunk of parsed items into import_items.
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

    // Verify ownership of the job
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("id, user_id, status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Import job not found or unauthorized" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided in batch" },
        { status: 400 }
      );
    }

    // Server-side validation of every row
    // Ensure title is present and plain text, cap review at 10k chars
    const validatedInserts = items.map((raw: ParsedImportItem) => {
      const title = String(raw.title || "").trim();
      if (!title) {
        throw new Error("Every row must have a valid title");
      }

      const review = typeof raw.review === "string" ? raw.review.slice(0, 10000) : null;
      const rating =
        typeof raw.rating === "number" && raw.rating >= 0 && raw.rating <= 100
          ? raw.rating
          : null;

      const safeRow: ParsedImportItem = {
        source: raw.source === "goodreads" ? "goodreads" : "letterboxd",
        title,
        year: typeof raw.year === "number" ? raw.year : null,
        author: raw.author ? String(raw.author).trim().slice(0, 500) : null,
        letterboxd_uri: raw.letterboxd_uri ? String(raw.letterboxd_uri).trim() : null,
        isbn13: raw.isbn13 ? String(raw.isbn13).trim() : null,
        isbn10: raw.isbn10 ? String(raw.isbn10).trim() : null,
        rating,
        review,
        contains_spoilers: Boolean(raw.contains_spoilers),
        status:
          raw.status === "in_progress" || raw.status === "planned" || raw.status === "dropped"
            ? raw.status
            : "completed",
        completed_at: raw.completed_at ? String(raw.completed_at) : null,
        created_at: raw.created_at ? String(raw.created_at) : undefined,
      };

      return {
        job_id: jobId,
        row: safeRow as unknown as import("@/types/database.types").Json,
        status: "pending",
      };
    });

    const { error: insertErr } = await supabase
      .from("import_items")
      .insert(validatedInserts);

    if (insertErr) {
      console.error("Batch insert items error:", insertErr);
      return NextResponse.json(
        { error: "Failed to store batch items into import job" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inserted: validatedInserts.length,
    });
  } catch (err: unknown) {
    console.error("POST /api/import/jobs/[id]/items error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 400 }
    );
  }
}
