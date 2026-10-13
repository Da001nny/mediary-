import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  syncTMDBMovieToMedia,
  syncTMDBTVToMedia,
  syncRAWGGameToMedia,
  syncGoogleBookToMedia,
  resolveImportPrivacy,
} from "@/lib/import-service";
import type { ParsedImportItem } from "@/lib/import-parser";

/**
 * POST /api/import/items/[id]/resolve
 * Resolves a needs_review item by either selecting a candidate or skipping.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await context.params;
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

    // 1. Fetch item and verify ownership through import_jobs
    const { data: item, error: itemErr } = await supabase
      .from("import_items")
      .select("id, job_id, row, status")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr || !item) {
      return NextResponse.json(
        { error: "Import item not found" },
        { status: 404 }
      );
    }

    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("id, user_id, options, matched, already_logged, needs_review")
      .eq("id", item.job_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Unauthorized access to import item" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, candidate } = body; // action: 'pick' | 'skip'

    if (action === "skip") {
      await supabase
        .from("import_items")
        .update({ status: "skipped" })
        .eq("id", itemId);

      const currentNeedsReview = Math.max(0, (job.needs_review || 1) - 1);
      await supabase
        .from("import_jobs")
        .update({
          needs_review: currentNeedsReview,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json({ success: true, status: "skipped" });
    }

    if (action === "pick") {
      const rawgId =
        candidate?.rawg_id ??
        (candidate?.type === "game" || candidate?.media_type === "game"
          ? candidate?.id
          : undefined);
      const tmdbId =
        candidate?.tmdb_id ??
        (candidate?.type === "movie" ||
        candidate?.type === "tv" ||
        candidate?.media_type === "movie" ||
        candidate?.media_type === "tv"
          ? candidate?.id
          : undefined);
      const googleBooksId =
        candidate?.google_books_id ??
        (candidate?.type === "book" || candidate?.media_type === "book"
          ? candidate?.id
          : undefined);

      if (!candidate || (!rawgId && !tmdbId && !googleBooksId)) {
        return NextResponse.json(
          {
            error:
              "Candidate selection requires tmdb_id, google_books_id, or rawg_id",
          },
          { status: 400 }
        );
      }

      // Sync candidate to media
      let mediaId: string;
      const isTv =
        candidate?.type === "tv" ||
        candidate?.media_type === "tv" ||
        (item.row as Record<string, unknown>)?.type === "tv" ||
        (item.row as Record<string, unknown>)?.media_type === "tv";

      if (rawgId) {
        mediaId = await syncRAWGGameToMedia(rawgId);
      } else if (tmdbId) {
        if (isTv) {
          mediaId = await syncTMDBTVToMedia(Number(tmdbId));
        } else {
          mediaId = await syncTMDBMovieToMedia(Number(tmdbId));
        }
      } else {
        mediaId = await syncGoogleBookToMedia(String(googleBooksId));
      }

      const row = item.row as unknown as ParsedImportItem;

      // Check if user already logged this media item
      const { data: existingEntry } = await supabase
        .from("entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("media_id", mediaId)
        .maybeSingle();

      const currentNeedsReview = Math.max(0, (job.needs_review || 1) - 1);

      if (existingEntry) {
        await supabase
          .from("import_items")
          .update({
            status: "already_logged",
            media_id: mediaId,
          })
          .eq("id", itemId);

        await supabase
          .from("import_jobs")
          .update({
            needs_review: currentNeedsReview,
            already_logged: (job.already_logged || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return NextResponse.json({ success: true, status: "already_logged", mediaId });
      }

      // Resolve privacy
      const chosenPrivacyOpt = (job.options as Record<string, string>)?.privacy;
      const resolvedPrivacy = await resolveImportPrivacy(
        supabase,
        user.id,
        chosenPrivacyOpt
      );

      // Insert into entries without calling activity helpers
      const { error: insertErr } = await supabase.from("entries").insert({
        user_id: user.id,
        media_id: mediaId,
        status: row.status,
        rating: row.rating,
        review: row.review,
        contains_spoilers: row.contains_spoilers,
        privacy: resolvedPrivacy,
        completed_at: row.completed_at || null,
        created_at: row.completed_at || new Date().toISOString(),
      });

      if (insertErr) {
        if (insertErr.code === "23505") {
          // Unique constraint hit (already logged)
          await supabase
            .from("import_items")
            .update({ status: "already_logged", media_id: mediaId })
            .eq("id", itemId);

          await supabase
            .from("import_jobs")
            .update({
              needs_review: currentNeedsReview,
              already_logged: (job.already_logged || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          return NextResponse.json({ success: true, status: "already_logged", mediaId });
        }

        console.error("Failed to insert resolved entry:", insertErr);
        return NextResponse.json(
          { error: "Failed to create diary entry for selected title" },
          { status: 500 }
        );
      }

      await supabase
        .from("import_items")
        .update({
          status: "matched",
          media_id: mediaId,
        })
        .eq("id", itemId);

      await supabase
        .from("import_jobs")
        .update({
          needs_review: currentNeedsReview,
          matched: (job.matched || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json({ success: true, status: "matched", mediaId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("POST /api/import/items/[id]/resolve error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
