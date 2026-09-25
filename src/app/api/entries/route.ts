import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntryStatus, PrivacyLevel } from "@/types/database.types";

const VALID_STATUSES: EntryStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "dropped",
  "on_hold",
];

const VALID_PRIVACIES: PrivacyLevel[] = ["public", "friends", "private"];

/**
 * GET /api/entries?media_id=UUID
 * Retrieves an entry for the authenticated user and given media_id,
 * or public entries for that media.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("media_id");

    if (!mediaId) {
      return NextResponse.json(
        { error: "media_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      // In demo mode without configured Supabase
      return NextResponse.json({ entry: null, isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Unauthenticated: Fetch public entries for this media
      const { data: publicEntries } = await supabase
        .from("entries")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("media_id", mediaId)
        .eq("privacy", "public")
        .limit(10);

      return NextResponse.json({ entry: null, publicEntries: publicEntries || [] });
    }

    // Authenticated: Fetch this user's entry for the media
    const { data: userEntry, error } = await supabase
      .from("entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("media_id", mediaId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching user entry:", error);
    }

    return NextResponse.json({ entry: userEntry || null });
  } catch (err) {
    console.error("GET /api/entries error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch entry" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/entries
 * Upserts a media log entry for the authenticated user + media_id,
 * strictly respecting the unique(user_id, media_id) constraint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      media_id,
      status,
      rating,
      review,
      privacy = "public",
      tmdb_id,
      media_type = "movie",
    } = body;

    if (!media_id) {
      return NextResponse.json(
        { error: "media_id is required" },
        { status: 400 }
      );
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (
      rating !== undefined &&
      rating !== null &&
      (typeof rating !== "number" || rating < 0 || rating > 5)
    ) {
      return NextResponse.json(
        { error: "Rating must be a number between 0 and 5 stars" },
        { status: 400 }
      );
    }

    if (privacy && !VALID_PRIVACIES.includes(privacy)) {
      return NextResponse.json(
        { error: "Privacy must be 'public', 'friends', or 'private'" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if Supabase server environment is configured
    if (!supabase) {
      // Mock / Demo fallback response
      const mockEntry = {
        id: `mock-entry-${Date.now()}`,
        user_id: "demo-user-id",
        media_id,
        status,
        rating: rating ?? null,
        review: review ? String(review).trim() : null,
        privacy,
        started_at: status === "in_progress" ? new Date().toISOString() : null,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return NextResponse.json({ entry: mockEntry, isMock: true });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to log a title to your diary." },
        { status: 401 }
      );
    }

    // Resolve media_id: Ensure it is a valid UUID in the public.media table
    let resolvedMediaId = media_id;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        media_id
      );

    if (!isUuid) {
      // Look up existing media row by external_ids->>tmdb_id or create it via admin client
      const adminSupabase = createAdminClient() || supabase;
      const lookupId = tmdb_id || media_id.replace(/^[a-z]+-/, "");

      const { data: existingMedia } = await adminSupabase
        .from("media")
        .select("id")
        .filter("external_ids->>tmdb_id", "eq", String(lookupId))
        .maybeSingle();

      if (existingMedia?.id) {
        resolvedMediaId = existingMedia.id;
      } else {
        // Create basic media row placeholder if not yet synced
        const { data: newMedia, error: createMediaError } = await adminSupabase
          .from("media")
          .insert({
            type: media_type,
            title: body.title || "Untitled Media",
            cover_url: body.cover_url || null,
            external_ids: { tmdb_id: lookupId },
            last_synced_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createMediaError || !newMedia) {
          return NextResponse.json(
            { error: "Could not register media item in catalog." },
            { status: 500 }
          );
        }
        resolvedMediaId = newMedia.id;
      }
    }

    // Upsert entry row respecting unique(user_id, media_id)
    const upsertPayload = {
      user_id: user.id,
      media_id: resolvedMediaId,
      status,
      rating: rating !== undefined && rating !== null ? Number(rating) : null,
      review: review ? String(review).trim() : null,
      privacy,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      started_at: status === "in_progress" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedEntry, error: upsertError } = await supabase
      .from("entries")
      .upsert(upsertPayload, {
        onConflict: "user_id,media_id",
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting entry:", upsertError);
      return NextResponse.json(
        { error: upsertError.message || "Failed to upsert diary entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entry: upsertedEntry,
      message: "Diary entry saved successfully.",
    });
  } catch (err) {
    console.error("POST /api/entries error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save entry" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entries?media_id=UUID
 * Deletes the entry for the authenticated user and media_id.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("media_id");

    if (!mediaId) {
      return NextResponse.json(
        { error: "media_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: true, isMock: true });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { error: deleteError } = await supabase
      .from("entries")
      .delete()
      .eq("user_id", user.id)
      .eq("media_id", mediaId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete entry" },
      { status: 500 }
    );
  }
}
