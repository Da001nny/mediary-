import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MediaItem } from "@/types/database.types";
import { formatMediaForAlgolia } from "@/lib/algolia";

/**
 * GET /api/media/search-db?q=fight+club&type=movie
 * Fallback endpoint querying public.media directly using normal Supabase client under RLS.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = (searchParams.get("q") || "").trim();
    const typeFilter = searchParams.get("type") || "all";

    if (rawQuery.length < 2 || rawQuery.length > 100) {
      return NextResponse.json(
        { error: "Search query must be between 2 and 100 characters.", results: [], count: 0 },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({
        results: [],
        count: 0,
        message: "Database connection not configured",
      });
    }

    // Escape % and _ characters in q before building the ILIKE pattern
    const escaped = rawQuery.replace(/[%_]/g, "\\$&");

    // Return at most 20 rows
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit <= 0 ? 20 : rawLimit, 20);

    let dbQuery = supabase
      .from("media")
      .select("*")
      .ilike("title", `%${escaped}%`)
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
