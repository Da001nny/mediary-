import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntryStatus, PrivacyLevel, TablesInsert } from "@/types/database.types";

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
    const includeReviews = searchParams.get("include_reviews") === "true" || searchParams.get("reviews") === "true";

    if (!mediaId) {
      return NextResponse.json(
        { error: "media_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      // In demo mode without configured Supabase
      return NextResponse.json({ entry: null, publicEntries: [], isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch user entry if authenticated
    let userEntry = null;
    if (user) {
      const { data: entryData, error } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("media_id", mediaId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user entry:", error);
      }
      userEntry = entryData;
    }

    // If requested or if user is unauthenticated, fetch public (and mutual friends) entries/reviews
    let publicEntries = null;
    if (includeReviews || !user) {
      let query = supabase
        .from("entries")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("media_id", mediaId);

      if (user) {
        // Fetch mutual friends to include their 'friends' entries
        const { data: myFollowing } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        const myFollowingIds = (myFollowing || []).map((f) => f.following_id);

        let mutualFriendIds: string[] = [];
        if (myFollowingIds.length > 0) {
          const { data: theyFollowMe } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", user.id)
            .in("follower_id", myFollowingIds);
          mutualFriendIds = (theyFollowMe || []).map((f) => f.follower_id);
        }

        if (mutualFriendIds.length > 0) {
          query = query.or(
            `privacy.eq.public,and(privacy.eq.friends,user_id.in.(${mutualFriendIds.join(",")}))`
          );
        } else {
          query = query.eq("privacy", "public");
        }
      } else {
        query = query.eq("privacy", "public");
      }

      const { data: pubData, error: pubError } = await query
        .order("created_at", { ascending: false })
        .limit(20);

      if (pubError) {
        console.error("Error fetching public entries:", pubError);
      }
      publicEntries = pubData || [];
    }

    return NextResponse.json({
      entry: userEntry || null,
      publicEntries: publicEntries || [],
    });
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
      progress,
      review,
      contains_spoilers = false,
      privacy = "public",
      tmdb_id,
      media_type = "movie",
    } = body;

    const hasSpoilers = Boolean(contains_spoilers || progress?.contains_spoilers);

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

    let normalizedRating: number | null = null;
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || rating < 0 || rating > 100) {
        return NextResponse.json(
          { error: "Rating must be a normalized number between 0 and 100" },
          { status: 400 }
        );
      }
      // Support conversion if a legacy 0-5 decimal was sent (e.g. 3.5 -> 70)
      normalizedRating =
        rating > 0 && rating <= 5 && !Number.isInteger(rating)
          ? Math.round(rating * 20)
          : Math.round(rating);
    }

    const sanitizedProgress: Record<string, unknown> =
      progress && typeof progress === "object" ? { ...(progress as Record<string, unknown>) } : {};
    sanitizedProgress.contains_spoilers = hasSpoilers;

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
        rating: normalizedRating,
        progress: sanitizedProgress,
        review: review ? String(review).trim() : null,
        contains_spoilers: hasSpoilers,
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
    const upsertPayload: TablesInsert<"entries"> = {
      user_id: user.id,
      media_id: resolvedMediaId,
      status,
      rating: normalizedRating,
      progress: sanitizedProgress,
      review: review ? String(review).trim() : null,
      contains_spoilers: hasSpoilers,
      privacy,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      started_at: status === "in_progress" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    let upsertResult = await supabase
      .from("entries")
      .upsert(upsertPayload, {
        onConflict: "user_id,media_id",
      })
      .select()
      .single();

    // If database table doesn't have contains_spoilers column yet, retry without it
    if (
      upsertResult.error &&
      (upsertResult.error.message.includes("contains_spoilers") ||
        upsertResult.error.code === "42703")
    ) {
      const fallbackPayload: TablesInsert<"entries"> = { ...upsertPayload };
      delete fallbackPayload.contains_spoilers;
      upsertResult = await supabase
        .from("entries")
        .upsert(fallbackPayload, {
          onConflict: "user_id,media_id",
        })
        .select()
        .single();
    }

    const { data: upsertedEntry, error: upsertError } = upsertResult;

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
