/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase Edge Function: algolia-backfill
// Reads all existing rows from public.media and bulk-indexes them into Algolia
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatMediaForAlgolia(record: Record<string, any>) {
  let year: number | null = null;
  if (record.release_date && typeof record.release_date === "string") {
    const y = parseInt(record.release_date.slice(0, 4), 10);
    if (!isNaN(y)) year = y;
  }

  const typeSpecific = record.type_specific || {};
  const author = typeof typeSpecific.author === "string" ? typeSpecific.author : null;
  const director = typeof typeSpecific.director === "string" ? typeSpecific.director : null;
  const developer = typeof typeSpecific.developer === "string" ? typeSpecific.developer : null;
  const platforms = Array.isArray(typeSpecific.platforms) ? typeSpecific.platforms : [];

  return {
    objectID: String(record.id),
    id: String(record.id),
    type: record.type,
    title: record.title,
    cover_url: record.cover_url || null,
    release_date: record.release_date || null,
    year,
    genres: Array.isArray(record.genres) ? record.genres : [],
    synopsis: record.synopsis || null,
    community_rating_avg: record.community_rating_avg ?? null,
    community_rating_count: record.community_rating_count ?? 0,
    author,
    director,
    platforms,
    developer,
    external_ids: record.external_ids || {},
    last_synced_at: record.last_synced_at || new Date().toISOString(),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const algoliaAppId = Deno.env.get("ALGOLIA_APP_ID") || Deno.env.get("NEXT_PUBLIC_ALGOLIA_APP_ID");
    const algoliaAdminKey = Deno.env.get("ALGOLIA_ADMIN_API_KEY") || Deno.env.get("ALGOLIA_API_KEY");
    const algoliaIndexName = Deno.env.get("ALGOLIA_INDEX_NAME") || Deno.env.get("NEXT_PUBLIC_ALGOLIA_INDEX_NAME") || "media";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!algoliaAppId || !algoliaAdminKey) {
      return new Response(
        JSON.stringify({ error: "Missing Algolia credentials (ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all media records
    const { data: mediaItems, error: fetchError } = await supabase
      .from("media")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch media records from Supabase", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const records = (mediaItems || []).map(formatMediaForAlgolia);

    // 2. Configure index settings (searchable attributes, custom ranking, faceting)
    const settingsUrl = `https://${algoliaAppId}-dsn.algolia.net/1/indexes/${encodeURIComponent(algoliaIndexName)}/settings`;
    await fetch(settingsUrl, {
      method: "PUT",
      headers: {
        "X-Algolia-Application-Id": algoliaAppId,
        "X-Algolia-API-Key": algoliaAdminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchableAttributes: [
          "title",
          "unordered(genres)",
          "author",
          "director",
          "developer",
          "synopsis",
        ],
        attributesForFaceting: [
          "filterOnly(type)",
          "genres",
          "year",
        ],
        customRanking: [
          "desc(community_rating_count)",
          "desc(community_rating_avg)",
          "desc(year)",
        ],
        typoTolerance: true,
      }),
    });

    // 3. Batch upload records to Algolia
    const batchUrl = `https://${algoliaAppId}-dsn.algolia.net/1/indexes/${encodeURIComponent(algoliaIndexName)}/batch`;
    const batchRequests = records.map((record) => ({
      action: "updateObject",
      body: record,
    }));

    // Chunk into batches of 1000
    const BATCH_SIZE = 1000;
    const batchResponses = [];

    for (let i = 0; i < batchRequests.length; i += BATCH_SIZE) {
      const chunk = batchRequests.slice(i, i + BATCH_SIZE);
      const res = await fetch(batchUrl, {
        method: "POST",
        headers: {
          "X-Algolia-Application-Id": algoliaAppId,
          "X-Algolia-API-Key": algoliaAdminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: chunk }),
      });
      const data = await res.json();
      batchResponses.push(data);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully backfilled ${records.length} media records to Algolia index '${algoliaIndexName}'`,
        totalIndexed: records.length,
        indexName: algoliaIndexName,
        batches: batchResponses.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in algolia-backfill edge function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
