import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchGoogleBooks } from "@/lib/google-books";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/books/search?q=query
 *
 * Searches books via Google Books API (or fallback curated mock library).
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
        { error: "Unauthorized: You must be signed in to search books." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || searchParams.get("query") || "").trim();

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json(
        { error: "Search query must be between 2 and 100 characters." },
        { status: 400 }
      );
    }

    const isAllowed = await checkRateLimit(`search:${user.id}`, 30, 60);
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. You're searching too fast, try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const { results, isMock, error } = await searchGoogleBooks(query);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      results,
      count: results.length,
      isMock,
      source: isMock ? "mock_catalog" : "google_books_live_api",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
