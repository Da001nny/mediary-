import { NextRequest, NextResponse } from "next/server";
import { fetchTMDBDetails } from "@/lib/tmdb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import type { TablesInsert, Json, MediaItem } from "@/types/database.types";

const ALLOWED_TMDB_TYPES = ["movie", "tv"] as const;
type AllowedTMDBType = (typeof ALLOWED_TMDB_TYPES)[number];

/**
 * POST /api/tmdb/sync
 * Body: { id: number, type: "movie" | "tv" }
 *
 * Fetches details from TMDB with credits and watch providers,
 * and upserts the result into the Supabase `media` table.
 *
 * Requirements:
 * 1. Requires signed-in user (verified via supabase.auth.getUser()). Returns 401 otherwise.
 * 2. Strict input validation: numeric ID in sane range (1 to 10,000,000), type from allowed list. Returns 400 otherwise.
 * 3. Never returns raw upstream error bodies or internal details to the client.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication Guard: Verify signed-in user with supabase.auth.getUser()
    const supabaseServer = await createClient();
    if (!supabaseServer) {
      return NextResponse.json(
        { error: "Unauthorized: Service configuration unavailable" },
        { status: 401 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const {
      data: { user },
      error: authError,
    } = bearerToken
      ? await supabaseServer.auth.getUser(bearerToken)
      : await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be signed in to sync media items" },
        { status: 401 }
      );
    }

    // 2. Strict Input Validation Guard
    let rawId: unknown;
    let rawType: unknown;

    try {
      const body = await req.json();
      rawId = body.id ?? body.tmdb_id;
      rawType = body.type ?? body.media_type;
    } catch {
      const { searchParams } = new URL(req.url);
      rawId = searchParams.get("id") ?? searchParams.get("tmdb_id");
      rawType = searchParams.get("type") ?? searchParams.get("media_type");
    }

    const idNum = Number(rawId);
    if (
      rawId === undefined ||
      rawId === null ||
      rawId === "" ||
      !Number.isInteger(idNum) ||
      idNum < 1 ||
      idNum > 10_000_000
    ) {
      return NextResponse.json(
        {
          error:
            "Bad Request: 'id' must be a positive integer between 1 and 10000000",
        },
        { status: 400 }
      );
    }

    if (!rawType || !ALLOWED_TMDB_TYPES.includes(rawType as AllowedTMDBType)) {
      return NextResponse.json(
        {
          error: `Bad Request: 'type' must be one of: ${ALLOWED_TMDB_TYPES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const id = idNum;
    const type = rawType as AllowedTMDBType;

    // 3. Fetch details from TMDB (with credits, cast, crew, watch providers)
    const { data: details, error: tmdbError, isMock } = await fetchTMDBDetails(id, type);

    if (tmdbError || !details) {
      console.error(`TMDB details fetch failed for ID ${id} (${type}):`, tmdbError);
      return NextResponse.json(
        { error: "Media title not found on TMDB" },
        { status: 404 }
      );
    }

    // 4. Prepare payload matching media table schema
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

    // 5. Upsert into Supabase public.media
    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        persisted: false,
        message: "Supabase credentials not configured in environment.",
        isMock,
        media: {
          id: `${type}-${details.tmdb_id}`,
          ...payload,
        },
      });
    }

    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>tmdb_id", "eq", String(details.tmdb_id))
      .eq("type", type)
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
        { error: "Failed to persist media title to database" },
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
      { error: "Internal server error during media synchronization" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tmdb/sync?id=550&type=movie
 * Allows testing sync via browser GET request when authenticated.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
