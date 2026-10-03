import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bulkIndexMedia,
  configureAlgoliaIndex,
  getAlgoliaServerConfig,
} from "@/lib/algolia";
import type { MediaItem } from "@/types/database.types";

/**
 * POST /api/admin/algolia/backfill
 * GET /api/admin/algolia/backfill
 *
 * One-time backfill endpoint that reads every existing row from public.media
 * and bulk-indexes them into Algolia using the Algolia Admin API key.
 */
async function handleBackfill() {
  try {
    const { isAdminConfigured, indexName } = getAlgoliaServerConfig();

    if (!isAdminConfigured) {
      return NextResponse.json(
        {
          error: "Algolia Admin credentials are not configured",
          message:
            "Please ensure ALGOLIA_APP_ID (or NEXT_PUBLIC_ALGOLIA_APP_ID) and ALGOLIA_ADMIN_API_KEY environment variables are set.",
          success: false,
        },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        {
          error: "Supabase connection is not configured on the server",
          success: false,
        },
        { status: 500 }
      );
    }

    // 1. Fetch all media records from Supabase public.media table
    const { data, error: dbError } = await adminClient
      .from("media")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("Database query failed during Algolia backfill:", dbError);
      return NextResponse.json(
        {
          error: "Failed to read records from database",
          details: dbError.message,
          success: false,
        },
        { status: 500 }
      );
    }

    const mediaList = (data || []) as MediaItem[];

    // 2. Configure Algolia index settings (searchable attributes, ranking, facets)
    try {
      await configureAlgoliaIndex();
    } catch (cfgErr) {
      console.warn("Algolia index settings configuration warning:", cfgErr);
    }

    // 3. Bulk index media records into Algolia
    const indexResult = await bulkIndexMedia(mediaList);

    return NextResponse.json({
      success: true,
      message: `Successfully backfilled ${mediaList.length} media titles into Algolia index '${indexName}'`,
      totalIndexed: mediaList.length,
      indexName,
      batchDetails: indexResult,
      sampleIndexedTitles: mediaList.slice(0, 10).map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("Algolia backfill error:", err);
    return NextResponse.json(
      {
        error: "Internal server error during Algolia backfill",
        message: err instanceof Error ? err.message : String(err),
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return handleBackfill();
}

export async function GET() {
  return handleBackfill();
}
