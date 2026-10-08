import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleBookDetails, bookToMediaPayload } from "@/lib/google-books";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import type { TablesInsert, MediaItem } from "@/types/database.types";

/**
 * POST /api/books/sync
 * Body: { id: string } or { google_books_id: string }
 * Or query param: ?id=B1hSG45uGwEC
 *
 * Fetches book details from Google Books and upserts into Supabase `media` table.
 */
export async function POST(req: NextRequest) {
  try {
    let id: string | null = null;

    try {
      const body = await req.json();
      id = body.id || body.google_books_id || null;
    } catch {
      const { searchParams } = new URL(req.url);
      id = searchParams.get("id") || searchParams.get("google_books_id");
    }

    if (!id) {
      return NextResponse.json(
        { error: "A valid 'id' or 'google_books_id' is required" },
        { status: 400 }
      );
    }

    // 1. Fetch details from Google Books
    const { data: details, error: bookError, isMock } = await fetchGoogleBookDetails(id);

    if (bookError || !details) {
      return NextResponse.json(
        { error: bookError || `Failed to fetch book details for ID '${id}'` },
        { status: 404 }
      );
    }

    // 2. Prepare payload matching media table schema
    const payload: TablesInsert<"media"> = bookToMediaPayload(details);

    // 3. Upsert into Supabase public.media
    const supabase = createAdminClient();

    if (!supabase) {
      // Supabase credentials not configured in environment
      return NextResponse.json({
        success: true,
        persisted: false,
        message: "Supabase credentials not configured; returned fetched book details.",
        isMock,
        media: {
          id: `book-${details.google_books_id}`,
          ...payload,
        },
      });
    }

    // Check if book already exists with external_ids->>google_books_id
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>google_books_id", "eq", details.google_books_id)
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

    // Best-effort server-side indexing into Algolia
    if (inserted) {
      try {
        await indexMediaItem(inserted as MediaItem);
      } catch (algoliaErr) {
        console.warn("Best-effort Algolia indexing failed for book item:", algoliaErr);
      }
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
