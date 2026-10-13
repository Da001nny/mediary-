import { NextRequest, NextResponse } from "next/server";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import type { TablesInsert, Json, MediaItem } from "@/types/database.types";

const ALLOWED_GAME_TYPES = ["game"] as const;

/**
 * POST /api/games/sync
 * Body: { id: number, platform_played_on?: string, type?: "game" }
 *
 * Fetches game details from RAWG and upserts into Supabase `media` table.
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
        { error: "Unauthorized: Supabase client unavailable" },
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
        { error: "Unauthorized: You must be signed in to sync game titles" },
        { status: 401 }
      );
    }

    // 2. Strict Input Validation Guard
    let rawId: unknown;
    let rawType: unknown;
    let rawPlatform: unknown;

    try {
      const body = await req.json();
      rawId = body.id ?? body.rawg_id;
      rawType = body.type;
      rawPlatform = body.platform_played_on;
    } catch {
      const { searchParams } = new URL(req.url);
      rawId = searchParams.get("id") ?? searchParams.get("rawg_id");
      rawType = searchParams.get("type");
      rawPlatform = searchParams.get("platform_played_on");
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

    if (
      rawType !== undefined &&
      rawType !== null &&
      !ALLOWED_GAME_TYPES.includes(rawType as "game")
    ) {
      return NextResponse.json(
        {
          error: `Bad Request: 'type' must be one of: ${ALLOWED_GAME_TYPES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    if (rawPlatform !== undefined && rawPlatform !== null) {
      if (typeof rawPlatform !== "string" || rawPlatform.trim().length > 100) {
        return NextResponse.json(
          {
            error:
              "Bad Request: 'platform_played_on' must be a string up to 100 characters",
          },
          { status: 400 }
        );
      }
    }

    const id = idNum;
    const platformPlayedOn =
      typeof rawPlatform === "string" ? rawPlatform.trim() : null;

    // 3. Fetch details from RAWG
    const { data: details, error: rawgError, isMock } = await fetchRAWGGameDetails(id);

    if (rawgError || !details) {
      console.error(`RAWG game details fetch failed for ID ${id}:`, rawgError);
      return NextResponse.json(
        { error: "Game title not found on RAWG" },
        { status: 404 }
      );
    }

    // 4. Prepare payload matching media table schema
    const payloadData = rawgGameToMediaPayload(details);
    if (platformPlayedOn) {
      const existingTs = (payloadData.type_specific as Record<string, unknown>) || {};
      payloadData.type_specific = {
        ...existingTs,
        platform_played_on: platformPlayedOn,
      } as unknown as Json;
    }

    const payload: TablesInsert<"media"> = payloadData;

    // 5. Upsert into Supabase public.media
    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        persisted: false,
        message: "Supabase credentials not configured in environment.",
        isMock,
        media: {
          id: `game-${details.rawg_id}`,
          ...payload,
        },
      });
    }

    // Check if game already exists with external_ids->>rawg_id
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>rawg_id", "eq", String(details.rawg_id))
      .eq("type", "game")
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

    let { data: inserted, error: dbError } = upsertResult;

    if (dbError) {
      if (dbError.code === "23505") {
        const { data: conflictRow } = await supabase
          .from("media")
          .select()
          .filter("external_ids->>rawg_id", "eq", String(details.rawg_id))
          .eq("type", "game")
          .maybeSingle();

        if (conflictRow) {
          inserted = conflictRow;
          dbError = null;
        }
      }
    }

    if (dbError || !inserted) {
      console.error("Supabase game upsert error:", dbError);
      return NextResponse.json(
        { error: "Failed to persist game title to database" },
        { status: 500 }
      );
    }

    // Best-effort server-side indexing into Algolia
    if (inserted) {
      try {
        await indexMediaItem(inserted as MediaItem);
      } catch (algoliaErr) {
        console.warn("Best-effort Algolia indexing failed for game item:", algoliaErr);
      }
    }

    return NextResponse.json({
      success: true,
      persisted: true,
      isMock,
      media: inserted,
    });
  } catch (err: unknown) {
    console.error("Unhandled error in /api/games/sync:", err);
    return NextResponse.json(
      { error: "Internal server error during game synchronization" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/games/sync?id=3498
 * Allows testing sync via browser GET request when authenticated.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
