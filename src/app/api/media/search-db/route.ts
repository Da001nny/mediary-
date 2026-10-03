import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MediaItem } from "@/types/database.types";
import { formatMediaForAlgolia } from "@/lib/algolia";

/**
 * GET /api/media/search-db?q=fight+club&type=movie
 * Fallback endpoint querying public.media directly when Algolia keys are pending.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const typeFilter = searchParams.get("type") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    if (!query.trim()) {
      return NextResponse.json({ results: [], count: 0 });
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({
        results: [],
        count: 0,
        message: "Database connection not configured",
      });
    }

    let dbQuery = adminClient
      .from("media")
      .select("*")
      .ilike("title", `%${query.trim()}%`)
      .limit(limit);

    if (
      typeFilter === "movie" ||
      typeFilter === "tv" ||
      typeFilter === "game" ||
      typeFilter === "book"
    ) {
      dbQuery = dbQuery.eq("type", typeFilter);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("Database search error:", error);
      return NextResponse.json({ error: error.message, results: [], count: 0 }, { status: 500 });
    }

    const items = (data || []) as MediaItem[];
    const formatted = items.map(formatMediaForAlgolia);

    return NextResponse.json({
      results: formatted,
      count: formatted.length,
      isDatabaseFallback: true,
    });
  } catch (err: unknown) {
    console.error("Error in /api/media/search-db:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error", results: [], count: 0 },
      { status: 500 }
    );
  }
}
