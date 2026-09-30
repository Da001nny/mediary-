import { NextRequest, NextResponse } from "next/server";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert, Json } from "@/types/database.types";

/**
 * POST /api/games/sync
 * Body: { id: number | string, platform_played_on?: string }
 * Or query param: ?id=3498
 *
 * Fetches game details from RAWG and upserts into Supabase `media` table.
 */
export async function POST(req: NextRequest) {
  try {
    let id: number | string | null = null;
    let platformPlayedOn: string | null = null;

    try {
      const body = await req.json();
      id = body.id ?? body.rawg_id;
      platformPlayedOn = body.platform_played_on || null;
    } catch {
      const { searchParams } = new URL(req.url);
      id = searchParams.get("id") || searchParams.get("rawg_id");
      platformPlayedOn = searchParams.get("platform_played_on");
    }

    if (!id) {
      return NextResponse.json(
        { error: "A valid 'id' or 'rawg_id' is required" },
        { status: 400 }
      );
    }

    // 1. Fetch details from RAWG
    const { data: details, error: rawgError, isMock } = await fetchRAWGGameDetails(id);

    if (rawgError || !details) {
      return NextResponse.json(
        { error: rawgError || `Failed to fetch game details for ID ${id}` },
        { status: 404 }
      );
    }

    // 2. Prepare payload matching media table schema
    const payloadData = rawgGameToMediaPayload(details);
    if (platformPlayedOn) {
      const existingTs = (payloadData.type_specific as Record<string, unknown>) || {};
      payloadData.type_specific = {
        ...existingTs,
        platform_played_on: platformPlayedOn,
      } as unknown as Json;
    }

    const payload: TablesInsert<"media"> = payloadData;

    // 3. Upsert into Supabase public.media
    const supabase = createAdminClient();

    if (!supabase) {
      // Supabase credentials not configured in environment
      return NextResponse.json({
        success: true,
        persisted: false,
        message: "Supabase credentials not configured; returned fetched game details.",
        isMock,
        media: {
          id: `rawg-game-${details.rawg_id}`,
          ...payload,
        },
      });
    }

    // Check if game already exists with external_ids->>rawg_id
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>rawg_id", "eq", String(details.rawg_id))
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

    const { data: inserted, error: dbError } = upsertResult;

    if (dbError) {
      return NextResponse.json(
        {
          error: `Supabase DB Error: ${dbError.message}`,
          payload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      persisted: true,
      isMock,
      media: inserted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
