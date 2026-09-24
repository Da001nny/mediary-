/* eslint-disable @typescript-eslint/no-explicit-any */
// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  id?: number | string;
  tmdb_id?: number | string;
  type?: "movie" | "tv";
  media_type?: "movie" | "tv";
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let id: number | null = null;
    let type: "movie" | "tv" = "movie";

    if (req.method === "POST") {
      const body: SyncRequest = await req.json().catch(() => ({}));
      id = Number(body.id ?? body.tmdb_id);
      if (body.type === "tv" || body.type === "movie") type = body.type;
      else if (body.media_type === "tv" || body.media_type === "movie") type = body.media_type;
    } else {
      const url = new URL(req.url);
      id = Number(url.searchParams.get("id") || url.searchParams.get("tmdb_id"));
      const qType = url.searchParams.get("type") || url.searchParams.get("media_type");
      if (qType === "tv" || qType === "movie") type = qType;
    }

    if (!id || isNaN(id)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'id' or 'tmdb_id'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check TMDB API key
    const tmdbApiKey = Deno.env.get("TMDB_API_KEY");
    if (!tmdbApiKey) {
      return new Response(
        JSON.stringify({
          error: "TMDB_API_KEY secret is not set in Supabase Edge Function environment.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch from TMDB
    const tmdbUrl = new URL(`https://api.themoviedb.org/3/${type}/${id}`);
    tmdbUrl.searchParams.set("append_to_response", "credits,watch/providers,external_ids");
    tmdbUrl.searchParams.set("language", "en-US");

    const tmdbHeaders: Record<string, string> = { Accept: "application/json" };
    if (tmdbApiKey.startsWith("eyJ")) {
      tmdbHeaders["Authorization"] = `Bearer ${tmdbApiKey}`;
    } else {
      tmdbUrl.searchParams.set("api_key", tmdbApiKey);
    }

    const tmdbRes = await fetch(tmdbUrl.toString(), { headers: tmdbHeaders });
    if (!tmdbRes.ok) {
      return new Response(
        JSON.stringify({
          error: `TMDB API error: ${tmdbRes.status} ${tmdbRes.statusText}`,
        }),
        { status: tmdbRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = await tmdbRes.json();
    const isMovie = type === "movie";
    const releaseDate = (raw.release_date || raw.first_air_date || null) as string | null;

    // Filter Top Cast
    const rawCast = Array.isArray(raw.credits?.cast) ? raw.credits.cast : [];
    const cast = rawCast.slice(0, 20).map((c: any, idx: number) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path,
      order: typeof c.order === "number" ? c.order : idx,
    }));

    // Filter Key Crew
    const rawCrew = Array.isArray(raw.credits?.crew) ? raw.credits.crew : [];
    const keyJobs = new Set(["Director", "Screenplay", "Writer", "Original Music Composer", "Director of Photography", "Producer", "Creator"]);
    const crew = rawCrew.filter((c: any) => keyJobs.has(c.job)).slice(0, 20);

    // Watch providers
    const watchProviders = raw["watch/providers"]?.results || raw.watch_providers?.results || {};

    // Extract genre names as string[]
    const genres = Array.isArray(raw.genres)
      ? raw.genres.map((g: any) => (typeof g === "string" ? g : g.name)).filter(Boolean)
      : [];

    const mediaRecord = {
      type,
      title: raw.title || raw.name || "Untitled",
      cover_url: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null,
      release_date: releaseDate,
      genres,
      synopsis: raw.overview || null,
      type_specific: {
        runtime: isMovie ? raw.runtime : (raw.episode_run_time?.[0] || null),
        tagline: raw.tagline || null,
        original_title: raw.original_title || raw.original_name || null,
        status: raw.status || null,
        backdrop_url: raw.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}` : null,
        number_of_seasons: isMovie ? null : raw.number_of_seasons,
        number_of_episodes: isMovie ? null : raw.number_of_episodes,
        cast,
        crew,
        credits: { cast, crew },
      },
      external_ids: {
        tmdb_id: id,
        imdb_id: raw.external_ids?.imdb_id || raw.imdb_id || null,
      },
      watch_providers: watchProviders,
      localized_fields: {
        original_language: raw.original_language || null,
        spoken_languages: raw.spoken_languages || [],
        production_companies: raw.production_companies || [],
      },
      community_rating_avg: raw.vote_average || 0,
      community_rating_count: raw.vote_count || 0,
      last_synced_at: new Date().toISOString(),
    };

    // 3. Upsert into Supabase database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if item exists with external_ids->>tmdb_id
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>tmdb_id", "eq", String(id))
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
