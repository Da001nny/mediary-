import { NextRequest, NextResponse } from "next/server";
import { fetchTMDBDetails } from "@/lib/tmdb";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import type { TablesInsert, Json, MediaItem } from "@/types/database.types";

/**
 * POST /api/tmdb/sync
 * Body: { id: number, type: "movie" | "tv" }
 * Or query params: ?id=550&type=movie
 *
 * Fetches details from TMDB with credits and watch providers,
 * and upserts the result into the Supabase `media` table.
 */
export async function POST(req: NextRequest) {
  try {
    let id: number | null = null;
    let type: "movie" | "tv" = "movie";

    // Read body or fallback to query params
    try {
      const body = await req.json();
      id = Number(body.id ?? body.tmdb_id);
      if (body.type === "tv" || body.type === "movie") {
        type = body.type;
      } else if (body.media_type === "tv" || body.media_type === "movie") {
        type = body.media_type;
      }
    } catch {
      // Body might be empty, try query params
      const { searchParams } = new URL(req.url);
      id = Number(searchParams.get("id") || searchParams.get("tmdb_id"));
      const qType = searchParams.get("type") || searchParams.get("media_type");
      if (qType === "tv" || qType === "movie") type = qType;
    }

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { error: "A valid 'id' or 'tmdb_id' is required" },
        { status: 400 }
      );
    }

    // 1. Fetch details from TMDB (including credits, cast, crew, watch providers)
    const { data: details, error: tmdbError, isMock } = await fetchTMDBDetails(id, type);

    if (tmdbError || !details) {
      return NextResponse.json(
        { error: tmdbError || "Failed to fetch TMDB details" },
        { status: 404 }
      );
    }

    // 2. Prepare payload matching media table schema
    const genreNames: string[] = Array.isArray(details.genres)
      ? details.genres.map((g) => (typeof g === "string" ? g : g.name)).filter(Boolean)
      : [];

    const payload: TablesInsert<"media"> = {
      type: details.type,
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

    // 3. Upsert into Supabase public.media
    const supabase = createAdminClient();

    if (!supabase) {
      // Supabase credentials not yet configured
      return NextResponse.json({
        success: true,
        persisted: false,
        message: "Supabase credentials not configured in environment; returned fetched TMDB details.",
        media: payload,
        isMock,
      });
    }

    // Check if a row already exists with this TMDB ID in external_ids
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>tmdb_id", "eq", String(details.tmdb_id))
      .limit(1);

    const existingId = existingRows?.[0]?.id;

    let upsertResult;
    if (existingId) {
      upsertResult = await supabase
        .from("media")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single();
    } else {
      upsertResult = await supabase
        .from("media")
        .insert(payload)
        .select()
        .single();
    }

    const { data: upsertedData, error: dbError } = upsertResult;

    if (dbError) {
      console.error("Supabase upsert error:", dbError);
      return NextResponse.json(
        {
          error: `Database upsert error: ${dbError.message}`,
          details: dbError,
          fetchedData: payload,
        },
        { status: 500 }
      );
    }

    // Best-effort server-side indexing into Algolia
    if (upsertedData) {
      try {
        await indexMediaItem(upsertedData as MediaItem);
      } catch (algoliaErr) {
        console.warn("Best-effort Algolia indexing failed for TMDB item:", algoliaErr);
      }
    }

    return NextResponse.json({
      success: true,
      persisted: true,
      media: upsertedData,
      isMock,
    });
  } catch (error) {
    console.error("Unhandled error in /api/tmdb/sync:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tmdb/sync?id=550&type=movie
 * Allows testing sync via simple browser GET request.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id") || searchParams.get("tmdb_id"));
  const type = (searchParams.get("type") || "movie") as "movie" | "tv";

  if (!id || isNaN(id)) {
    return NextResponse.json(
      { error: "Missing required 'id' query parameter. Example: /api/tmdb/sync?id=550&type=movie" },
      { status: 400 }
    );
  }

  // Delegate to POST logic
  const mockReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, type }),
  });

  return POST(mockReq);
}
