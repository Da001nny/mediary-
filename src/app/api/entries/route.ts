import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordEntryActivity, removeActivity } from "@/lib/activity";
import { fetchTMDBDetails } from "@/lib/tmdb";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import { fetchGoogleBookDetails, bookToMediaPayload } from "@/lib/google-books";
import { indexMediaItem } from "@/lib/algolia";
import type {
  EntryStatus,
  PrivacyLevel,
  TablesInsert,
  MediaItem,
  Json,
  MediaType,
} from "@/types/database.types";

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

    // Resolve media_id via service-role admin client
    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { error: "Service role client not configured for media catalog operations." },
        { status: 500 }
      );
    }

    let resolvedMediaId: string;
    let resolvedMediaType: MediaType = "movie";

    const isUuid =
      typeof media_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        media_id
      );

    if (isUuid) {
      // Look up existing catalog title by UUID
      const { data: existingMedia } = await adminSupabase
        .from("media")
        .select("id, type")
        .eq("id", media_id)
        .maybeSingle();

      if (!existingMedia?.id) {
        return NextResponse.json(
          { error: "Media title not found in catalog." },
          { status: 404 }
        );
      }

      resolvedMediaId = existingMedia.id;
      resolvedMediaType = existingMedia.type;
    } else {
      // External identifier (media type plus provider id)
      // 1. Derive media type: from media_type, type, or typed prefix in media_id
      let targetType: MediaType | null = null;
      const rawType = body.media_type || body.type;

      if (rawType && (rawType === "movie" || rawType === "tv" || rawType === "game" || rawType === "book")) {
        targetType = rawType as MediaType;
      } else if (typeof media_id === "string") {
        if (media_id.startsWith("movie-")) targetType = "movie";
        else if (media_id.startsWith("tv-")) targetType = "tv";
        else if (media_id.startsWith("game-") || media_id.startsWith("rawg-")) targetType = "game";
        else if (media_id.startsWith("book-") || media_id.startsWith("gb-")) targetType = "book";
      }

      if (!targetType) {
        return NextResponse.json(
          { error: "Bad Request: 'media_type' must be one of: movie, tv, game, book" },
          { status: 400 }
        );
      }

      // 2. Derive provider from media type (movie/tv: TMDB, game: RAWG, book: Google Books)
      if (targetType === "movie" || targetType === "tv") {
        // TMDB provider
        const rawTmdbId =
          body.tmdb_id ??
          body.provider_id ??
          body.external_id ??
          (typeof media_id === "string" ? media_id.replace(/^(movie-|tv-)/i, "") : media_id);

        const idNum = Number(rawTmdbId);
        if (
          rawTmdbId === undefined ||
          rawTmdbId === null ||
          rawTmdbId === "" ||
          !Number.isInteger(idNum) ||
          idNum < 1 ||
          idNum > 10_000_000
        ) {
          return NextResponse.json(
            { error: "Bad Request: TMDB ID must be a positive integer between 1 and 10000000" },
            { status: 400 }
          );
        }

        // Look up the catalog by BOTH the provider's id and the media type
        const { data: existingRows } = await adminSupabase
          .from("media")
          .select("id, type")
          .filter("external_ids->>tmdb_id", "eq", String(idNum))
          .eq("type", targetType)
          .limit(1);

        let existingId = existingRows?.[0]?.id;
        if (!existingId) {
          const { data: byCol } = await adminSupabase
            .from("media")
            .select("id, type")
            .eq("tmdb_id", idNum)
            .eq("type", targetType)
            .limit(1);
          existingId = byCol?.[0]?.id;
        }

        if (existingId) {
          resolvedMediaId = existingId;
          resolvedMediaType = targetType;
        } else {
          // Fetch metadata server-side with TMDB helper (same as sync route)
          const { data: details, error: tmdbError } = await fetchTMDBDetails(idNum, targetType);
          if (tmdbError || !details) {
            return NextResponse.json(
              { error: tmdbError || "Media title not found on TMDB" },
              { status: 404 }
            );
          }

          const genreNames: string[] = Array.isArray(details.genres)
            ? details.genres.map((g) => (typeof g === "string" ? g : g.name)).filter(Boolean)
            : [];

          const payload: TablesInsert<"media"> = {
            type: details.type,
            tmdb_id: details.tmdb_id,
            imdb_id: details.imdb_id,
            title: details.title,
            cover_url: details.poster_url,
            release_date: details.release_date,
            genres: genreNames,
            synopsis: details.overview,
            type_specific: {
              runtime: details.runtime,
              tagline: details.tagline,
              original_title: details.original_title,
              status: details.status,
              backdrop_url: details.backdrop_url,
              number_of_seasons: details.number_of_seasons,
              number_of_episodes: details.number_of_episodes,
              cast: details.cast,
              crew: details.crew,
              credits: details.credits,
            } as unknown as Json,
            external_ids: {
              tmdb_id: details.tmdb_id,
              imdb_id: details.imdb_id,
            } as unknown as Json,
            watch_providers: details.watch_providers as unknown as Json,
            localized_fields: {
              original_language: details.original_language,
              spoken_languages: details.spoken_languages,
              production_companies: details.production_companies,
            } as unknown as Json,
            community_rating_avg: details.vote_average,
            community_rating_count: details.vote_count,
            last_synced_at: new Date().toISOString(),
          };

          const { data: newMedia, error: createMediaError } = await adminSupabase
            .from("media")
            .insert(payload)
            .select()
            .single();

          if (createMediaError || !newMedia) {
            console.error("Failed to insert media row from TMDB:", createMediaError);
            return NextResponse.json(
              { error: "Failed to persist media title to database" },
              { status: 500 }
            );
          }

          try {
            await indexMediaItem(newMedia as MediaItem);
          } catch (algoliaErr) {
            console.warn("Best-effort Algolia indexing failed for TMDB item:", algoliaErr);
          }

          resolvedMediaId = newMedia.id;
          resolvedMediaType = targetType;
        }
      } else if (targetType === "game") {
        // RAWG provider
        const rawRawgId =
          body.rawg_id ??
          body.provider_id ??
          body.external_id ??
          (typeof media_id === "string" ? media_id.replace(/^(game-|rawg-)/i, "") : media_id);

        const idNum = Number(rawRawgId);
        if (
          rawRawgId === undefined ||
          rawRawgId === null ||
          rawRawgId === "" ||
          !Number.isInteger(idNum) ||
          idNum < 1 ||
          idNum > 10_000_000
        ) {
          return NextResponse.json(
            { error: "Bad Request: RAWG ID must be a positive integer between 1 and 10000000" },
            { status: 400 }
          );
        }

        // Look up the catalog by BOTH the provider's id and the media type
        const { data: existingRows } = await adminSupabase
          .from("media")
          .select("id, type")
          .filter("external_ids->>rawg_id", "eq", String(idNum))
          .eq("type", "game")
          .limit(1);

        const existingId = existingRows?.[0]?.id;
        if (existingId) {
          resolvedMediaId = existingId;
          resolvedMediaType = "game";
        } else {
          // Fetch metadata server-side with RAWG helper (same as sync route)
          const { data: details, error: rawgError } = await fetchRAWGGameDetails(idNum);
          if (rawgError || !details) {
            return NextResponse.json(
              { error: rawgError || "Game title not found on RAWG" },
              { status: 404 }
            );
          }

          const payload = rawgGameToMediaPayload(details);

          const { data: newMedia, error: createMediaError } = await adminSupabase
            .from("media")
            .insert(payload)
            .select()
            .single();

          if (createMediaError || !newMedia) {
            console.error("Failed to insert media row from RAWG:", createMediaError);
            return NextResponse.json(
              { error: "Failed to persist game title to database" },
              { status: 500 }
            );
          }

          try {
            await indexMediaItem(newMedia as MediaItem);
          } catch (algoliaErr) {
            console.warn("Best-effort Algolia indexing failed for RAWG item:", algoliaErr);
          }

          resolvedMediaId = newMedia.id;
          resolvedMediaType = "game";
        }
      } else {
        // Google Books provider
        const rawBookId =
          body.google_books_id ??
          body.provider_id ??
          body.external_id ??
          (typeof media_id === "string" ? media_id.replace(/^(book-|gb-)/i, "") : media_id);

        const strId = String(rawBookId ?? "").trim();
        const isNumeric = /^\d+$/.test(strId);
        let isValidBookId = false;

        if (isNumeric) {
          const numId = Number(strId);
          isValidBookId = Number.isInteger(numId) && numId >= 1 && numId <= 10_000_000;
        } else {
          isValidBookId =
            strId.length >= 4 &&
            strId.length <= 64 &&
            /^[a-zA-Z0-9_\-]+$/.test(strId);
        }

        if (!isValidBookId) {
          return NextResponse.json(
            {
              error:
                "Bad Request: Google Books volume ID must be 4-64 alphanumeric characters or positive integer in sane range",
            },
            { status: 400 }
          );
        }

        // Look up the catalog by BOTH the provider's id and the media type
        const { data: existingRows } = await adminSupabase
          .from("media")
          .select("id, type")
          .filter("external_ids->>google_books_id", "eq", strId)
          .eq("type", "book")
          .limit(1);

        const existingId = existingRows?.[0]?.id;
        if (existingId) {
          resolvedMediaId = existingId;
          resolvedMediaType = "book";
        } else {
          // Fetch metadata server-side with Google Books helper (same as sync route)
          const { data: details, error: gbError } = await fetchGoogleBookDetails(strId);
          if (gbError || !details) {
            return NextResponse.json(
              { error: gbError || "Book title not found on Google Books" },
              { status: 404 }
            );
          }

          const payload = bookToMediaPayload(details);

          const { data: newMedia, error: createMediaError } = await adminSupabase
            .from("media")
            .insert(payload)
            .select()
            .single();

          if (createMediaError || !newMedia) {
            console.error("Failed to insert media row from Google Books:", createMediaError);
            return NextResponse.json(
              { error: "Failed to persist book title to database" },
              { status: 500 }
            );
          }

          try {
            await indexMediaItem(newMedia as MediaItem);
          } catch (algoliaErr) {
            console.warn("Best-effort Algolia indexing failed for Google Books item:", algoliaErr);
          }

          resolvedMediaId = newMedia.id;
          resolvedMediaType = "book";
        }
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

    // Record / synchronize activity feed entry
    if (upsertedEntry) {
      await recordEntryActivity({
        userId: user.id,
        entryId: upsertedEntry.id,
        privacy,
        mediaId: resolvedMediaId,
        mediaType: resolvedMediaType,
        rating: normalizedRating,
        review: review ? String(review).trim() : null,
        containsSpoilers: hasSpoilers,
        status,
        createdAt: upsertedEntry.created_at,
        client: supabase,
      });
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

    // Look up existing entry id before deletion to clean up its activity rows
    const { data: existingEntry } = await supabase
      .from("entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", mediaId)
      .maybeSingle();

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

    if (existingEntry?.id) {
      await removeActivity({
        userId: user.id,
        refId: existingEntry.id,
        client: supabase,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete entry" },
      { status: 500 }
    );
  }
}
