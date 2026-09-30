import { NextRequest, NextResponse } from "next/server";
import { searchGoogleBooks } from "@/lib/google-books";

/**
 * GET /api/books/search?q=query
 *
 * Searches books via Google Books API (or fallback curated mock library).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";

    if (!query.trim()) {
      return NextResponse.json({
        results: [],
        message: "Provide a search query using '?q=title+or+author'",
      });
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
