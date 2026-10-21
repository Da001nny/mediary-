import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchTMDB } from "@/lib/tmdb";

/**
 * GET /api/tmdb/search?q=fight+club&type=all&page=1
 * Simple TMDB search endpoint returning normalized results with poster thumbnails.
 *
 * Requires a signed-in user. Validates input q (2 to 100 characters after trimming).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
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
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be signed in to search titles." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || searchParams.get("query") || "").trim();
    const type = (searchParams.get("type") || "all") as "all" | "movie" | "tv";
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json(
        { error: "Search query must be between 2 and 100 characters." },
        { status: 400 }
      );
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
