import { NextRequest, NextResponse } from "next/server";
import { searchTMDB } from "@/lib/tmdb";

/**
 * GET /api/tmdb/search?q=fight+club&type=all&page=1
 * Simple TMDB search endpoint returning normalized results with poster thumbnails.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const type = (searchParams.get("type") || "all") as "all" | "movie" | "tv";
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;

    if (!query.trim()) {
      return NextResponse.json({
        results: [],
        page: 1,
        total_results: 0,
        total_pages: 0,
      });
    }

    const searchResults = await searchTMDB({
      query,
      type,
      page,
    });

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error("Error in /api/tmdb/search route:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
        results: [],
      },
      { status: 500 }
    );
  }
}
