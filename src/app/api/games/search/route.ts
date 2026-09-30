import { NextRequest, NextResponse } from "next/server";
import { searchRAWGGames } from "@/lib/rawg";

/**
 * GET /api/games/search?q=query
 *
 * Searches video games via RAWG API (or fallback curated mock database).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";

    if (!query.trim()) {
      return NextResponse.json({
        results: [],
        message: "Provide a search query using '?q=name'",
      });
    }

    const { results, isMock, error } = await searchRAWGGames(query);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      results,
      count: results.length,
      isMock,
      source: isMock ? "mock_catalog" : "rawg_live_api",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
