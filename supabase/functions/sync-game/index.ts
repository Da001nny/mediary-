/* eslint-disable @typescript-eslint/no-explicit-any */
// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncGameRequest {
  id?: number | string;
  rawg_id?: number | string;
  platform_played_on?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let id: number | null = null;
    let platformPlayedOn: string | null = null;

    if (req.method === "POST") {
      const body: SyncGameRequest = await req.json().catch(() => ({}));
      id = Number(body.id ?? body.rawg_id);
      platformPlayedOn = body.platform_played_on || null;
    } else {
      const url = new URL(req.url);
      id = Number(url.searchParams.get("id") || url.searchParams.get("rawg_id"));
      platformPlayedOn = url.searchParams.get("platform_played_on");
    }

    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'id' or 'rawg_id'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check RAWG API key
    const rawgApiKey = Deno.env.get("RAWG_API_KEY");
    if (!rawgApiKey) {
      return new Response(
        JSON.stringify({
          error: "RAWG_API_KEY secret is not set in Supabase Edge Function environment.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch game details from RAWG
    const rawgUrl = new URL(`https://api.rawg.io/api/games/${id}`);
    rawgUrl.searchParams.set("key", rawgApiKey);

    const rawgRes = await fetch(rawgUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!rawgRes.ok) {
      return new Response(
        JSON.stringify({
          error: `RAWG API error: ${rawgRes.status} ${rawgRes.statusText}`,
        }),
        { status: rawgRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = await rawgRes.json();

    // Fetch screenshots if possible
    let screenshots: string[] = [];
    try {
      const ssUrl = new URL(`https://api.rawg.io/api/games/${id}/screenshots`);
      ssUrl.searchParams.set("key", rawgApiKey);
      const ssRes = await fetch(ssUrl.toString(), {
        headers: { Accept: "application/json" },
      });
      if (ssRes.ok) {
        const ssData = await ssRes.json();
        screenshots = (ssData.results || [])
          .map((s: { image: string }) => s.image)
          .filter(Boolean);
      }
    } catch {
      // Fallback
    }

    if (screenshots.length === 0 && raw.short_screenshots) {
      screenshots = raw.short_screenshots.map((s: any) => s.image).filter(Boolean);
    }

    // Extract genres, platforms, developers, publishers
    const genres = Array.isArray(raw.genres)
      ? raw.genres.map((g: any) => g.name).filter(Boolean)
      : [];

    const platforms = Array.isArray(raw.platforms)
      ? raw.platforms.map((p: any) => p.platform?.name).filter(Boolean)
      : [];

    const developers = Array.isArray(raw.developers)
      ? raw.developers.map((d: any) => d.name).filter(Boolean)
      : [];

    const publishers = Array.isArray(raw.publishers)
      ? raw.publishers.map((p: any) => p.name).filter(Boolean)
      : [];

    const primaryDeveloper = developers[0] || "Unknown Developer";
    const primaryPublisher = publishers[0] || developers[0] || "Unknown Publisher";
    const primaryGenre = genres[0] || "Video Game";
    const resolvedPlatformPlayedOn = platformPlayedOn || platforms[0] || null;

    const mediaRecord = {
      type: "game",
      title: raw.name || "Untitled Game",
      cover_url: raw.background_image || null,
      release_date: raw.released || null,
      genres,
      synopsis: raw.description_raw || raw.description || null,
      type_specific: {
        platforms,
        platform_played_on: resolvedPlatformPlayedOn,
        developers,
        publishers,
        developer: primaryDeveloper,
        publisher: primaryPublisher,
        genre: primaryGenre,
        metacritic: raw.metacritic || null,
        esrb_rating: raw.esrb_rating?.name || null,
        website: raw.website || null,
        playtime: raw.playtime || 0,
        screenshots,
        backdrop_url: raw.background_image_additional || raw.background_image || null,
      },
      external_ids: {
        rawg_id: id,
        slug: raw.slug || null,
      },
      watch_providers: {},
      localized_fields: {
        slug: raw.slug || null,
        website: raw.website || null,
      },
      community_rating_avg: raw.rating || 0,
      community_rating_count: raw.ratings_count || 0,
      last_synced_at: new Date().toISOString(),
    };

    // 3. Upsert into Supabase database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if item exists with external_ids->>rawg_id
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>rawg_id", "eq", String(id))
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
