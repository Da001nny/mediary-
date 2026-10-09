import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleBookDetails, bookToMediaPayload } from "@/lib/google-books";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import type { TablesInsert, MediaItem } from "@/types/database.types";

const ALLOWED_BOOK_TYPES = ["book"] as const;

/**
 * POST /api/books/sync
 * Body: { id: string, type?: "book" }
 *
 * Fetches book details from Google Books and upserts into Supabase `media` table.
 *
 * Requirements:
 * 1. Requires signed-in user (verified via supabase.auth.getUser()). Returns 401 otherwise.
 * 2. Strict input validation: numeric ID in sane range or valid volume ID (4-64 alphanumeric chars), type from allowed list. Returns 400 otherwise.
 * 3. Never returns raw upstream error bodies or internal details to the client.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication Guard: Verify signed-in user with supabase.auth.getUser()
    const supabaseServer = await createClient();
    if (!supabaseServer) {
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
      ? await supabaseServer.auth.getUser(bearerToken)
      : await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be signed in to sync book titles" },
        { status: 401 }
      );
    }

    // 2. Strict Input Validation Guard
    let rawId: unknown;
    let rawType: unknown;

    try {
      const body = await req.json();
      rawId = body.id ?? body.google_books_id;
      rawType = body.type;
    } catch {
      const { searchParams } = new URL(req.url);
      rawId = searchParams.get("id") ?? searchParams.get("google_books_id");
      rawType = searchParams.get("type");
    }

    // Validate ID: Google Books volume IDs are alphanumeric strings (e.g. "B1hSG45uGwEC", 4-64 chars) or positive integers in sane range
    const isNumeric =
      typeof rawId === "number" ||
      (typeof rawId === "string" && /^\d+$/.test(rawId.trim()));

    let isValidId = false;

    if (isNumeric) {
      const numId = Number(rawId);
      isValidId = Number.isInteger(numId) && numId >= 1 && numId <= 10_000_000;
    } else if (typeof rawId === "string") {
      const trimmed = rawId.trim();
      isValidId =
        trimmed.length >= 4 &&
        trimmed.length <= 64 &&
        /^[a-zA-Z0-9_\-]+$/.test(trimmed);
    }

    if (!isValidId) {
      return NextResponse.json(
        {
          error:
            "Bad Request: 'id' must be a valid volume identifier (4-64 alphanumeric characters) or positive integer in sane range",
        },
        { status: 400 }
      );
    }

    if (
      rawType !== undefined &&
      rawType !== null &&
      !ALLOWED_BOOK_TYPES.includes(rawType as "book")
    ) {
      return NextResponse.json(
        {
          error: `Bad Request: 'type' must be one of: ${ALLOWED_BOOK_TYPES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const id = String(rawId).trim();

    // 3. Fetch details from Google Books
    const { data: details, error: bookError, isMock } = await fetchGoogleBookDetails(id);

    if (bookError || !details) {
      console.error(`Google Books details fetch failed for ID '${id}':`, bookError);
      return NextResponse.json(
        { error: "Book title not found on Google Books" },
        { status: 404 }
      );
    }

    // 4. Prepare payload matching media table schema
    const payload: TablesInsert<"media"> = bookToMediaPayload(details);

    // 5. Upsert into Supabase public.media
    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        persisted: false,
        message: "Supabase credentials not configured in environment.",
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
      .eq("type", "book")
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
      console.error("Supabase book upsert error:", dbError);
      return NextResponse.json(
        { error: "Failed to persist book title to database" },
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
    console.error("Unhandled error in /api/books/sync:", err);
    return NextResponse.json(
      { error: "Internal server error during book synchronization" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/books/sync?id=B1hSG45uGwEC
 * Allows testing sync via browser GET request when authenticated.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
