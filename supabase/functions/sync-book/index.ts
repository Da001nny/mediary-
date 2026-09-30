/* eslint-disable @typescript-eslint/no-explicit-any */
// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncBookRequest {
  id?: string;
  google_books_id?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let id: string | null = null;

    if (req.method === "POST") {
      const body: SyncBookRequest = await req.json().catch(() => ({}));
      id = body.id || body.google_books_id || null;
    } else {
      const url = new URL(req.url);
      id = url.searchParams.get("id") || url.searchParams.get("google_books_id");
    }

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing required 'id' or 'google_books_id'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanId = id.replace(/^(book-|gb-)/i, "");

    // 1. Fetch from Google Books API
    const googleBooksUrl = new URL(`https://www.googleapis.com/books/v1/volumes/${cleanId}`);
    const googleBooksApiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY");
    if (googleBooksApiKey) {
      googleBooksUrl.searchParams.set("key", googleBooksApiKey);
    }

    const bookRes = await fetch(googleBooksUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!bookRes.ok) {
      return new Response(
        JSON.stringify({
          error: `Google Books API error: ${bookRes.status} ${bookRes.statusText}`,
        }),
        { status: bookRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const b = await bookRes.json();
    const v = b.volumeInfo || {};

    const authors = Array.isArray(v.authors) ? v.authors : ["Unknown Author"];
    const primaryAuthor = authors[0];
    const rawImage =
      v.imageLinks?.extraLarge ||
      v.imageLinks?.large ||
      v.imageLinks?.medium ||
      v.imageLinks?.thumbnail ||
      v.imageLinks?.smallThumbnail ||
      null;

    const coverUrl = rawImage
      ? rawImage.replace(/^http:\/\//i, "https://").replace(/zoom=\d/i, "zoom=1").replace(/&edge=curl/gi, "")
      : null;

    const identifiers: Array<{ type: string; identifier: string }> = Array.isArray(v.industryIdentifiers)
      ? v.industryIdentifiers
      : [];
    const isbn13 = identifiers.find((i) => i.type === "ISBN_13")?.identifier || null;
    const isbn10 = identifiers.find((i) => i.type === "ISBN_10")?.identifier || null;
    const primaryIsbn = isbn13 || isbn10 || null;

    const genres = Array.isArray(v.categories) ? v.categories : ["Literature"];
    const series = v.subtitle || (v.seriesInfo?.seriesId ? `Series ${v.seriesInfo.seriesId}` : null);

    const mediaRecord = {
      type: "book",
      title: v.title || "Untitled Book",
      cover_url: coverUrl,
      release_date: v.publishedDate || null,
      genres,
      synopsis: v.description || null,
      type_specific: {
        author: primaryAuthor,
        authors,
        page_count: v.pageCount || null,
        edition: v.publisher ? `${v.publisher} Edition` : null,
        isbn: primaryIsbn,
        isbn_10: isbn10,
        isbn_13: isbn13,
        series,
        publisher: v.publisher || null,
        published_date: v.publishedDate || null,
        language: v.language || "en",
        preview_link: v.previewLink || null,
        info_link: v.infoLink || null,
      },
      external_ids: {
        google_books_id: b.id,
        isbn: primaryIsbn,
        isbn_10: isbn10,
        isbn_13: isbn13,
      },
      watch_providers: {},
      localized_fields: {
        subtitle: v.subtitle || null,
        author: primaryAuthor,
        publisher: v.publisher || null,
        isbn: primaryIsbn,
      },
      community_rating_avg: v.averageRating || null,
      community_rating_count: v.ratingsCount || 0,
      last_synced_at: new Date().toISOString(),
    };

    // 2. Upsert into Supabase database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if book exists with external_ids->>google_books_id
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>google_books_id", "eq", b.id)
      .limit(1);

    const existingId = existingRows?.[0]?.id;

    let upsertResult;
    if (existingId) {
      upsertResult = await supabase
        .from("media")
        .update(mediaRecord)
        .eq("id", existingId)
        .select()
        .single();
    } else {
      upsertResult = await supabase
        .from("media")
        .insert(mediaRecord)
        .select()
        .single();
    }

    const { data: inserted, error: dbError } = upsertResult;

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `Supabase DB Error: ${dbError.message}`, record: mediaRecord }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, media: inserted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
