/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase Edge Function: algolia-sync
// Triggered on INSERT or UPDATE (or DELETE) on public.media
// Pushes the updated media row to Algolia using the Admin API Key (server-side only)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type?: "INSERT" | "UPDATE" | "DELETE" | string;
  table?: string;
  schema?: string;
  record?: Record<string, any>;
  old_record?: Record<string, any>;
  id?: string;
}

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const algoliaAppId = Deno.env.get("ALGOLIA_APP_ID") || Deno.env.get("NEXT_PUBLIC_ALGOLIA_APP_ID");
    const algoliaAdminKey = Deno.env.get("ALGOLIA_ADMIN_API_KEY") || Deno.env.get("ALGOLIA_API_KEY");
    const algoliaIndexName = Deno.env.get("ALGOLIA_INDEX_NAME") || Deno.env.get("NEXT_PUBLIC_ALGOLIA_INDEX_NAME") || "media";

    if (!algoliaAppId || !algoliaAdminKey) {
      console.warn("Algolia Admin credentials missing in Edge Function environment.");
      return new Response(
        JSON.stringify({
          error: "ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY environment variable is missing",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: WebhookPayload = await req.json().catch(() => ({}));
    const eventType = payload.type?.toUpperCase() || (payload.record ? "INSERT" : "MANUAL");

    // Handle DELETE
    if (eventType === "DELETE") {
      const deleteId = payload.old_record?.id || payload.id;
      if (!deleteId) {
        return new Response(
          JSON.stringify({ error: "Missing record ID for deletion" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const algoliaUrl = `https://${algoliaAppId}-dsn.algolia.net/1/indexes/${encodeURIComponent(algoliaIndexName)}/${encodeURIComponent(deleteId)}`;
      const deleteRes = await fetch(algoliaUrl, {
        method: "DELETE",
        headers: {
          "X-Algolia-Application-Id": algoliaAppId,
          "X-Algolia-API-Key": algoliaAdminKey,
        },
      });

      const deleteData = await deleteRes.json();
      return new Response(
        JSON.stringify({ success: true, action: "deleted", objectID: deleteId, algoliaResponse: deleteData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle INSERT / UPDATE
    let record = payload.record;

    // If only an ID was provided without record, fetch from Supabase
    if (!record && payload.id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data, error } = await supabase
          .from("media")
          .select("*")
          .eq("id", payload.id)
          .maybeSingle();

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: `Media record not found for id ${payload.id}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        record = data;
      }
    }

    if (!record || !record.id || !record.title) {
      return new Response(
        JSON.stringify({ error: "Invalid media record payload. Must contain id and title." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const algoliaRecord = formatMediaForAlgolia(record);
    const algoliaUrl = `https://${algoliaAppId}-dsn.algolia.net/1/indexes/${encodeURIComponent(algoliaIndexName)}/${encodeURIComponent(algoliaRecord.objectID)}`;

    const response = await fetch(algoliaUrl, {
      method: "PUT",
      headers: {
        "X-Algolia-Application-Id": algoliaAppId,
        "X-Algolia-API-Key": algoliaAdminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(algoliaRecord),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Algolia indexing failed:", data);
      return new Response(
        JSON.stringify({ error: "Failed to push record to Algolia", details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: eventType,
        objectID: algoliaRecord.objectID,
        title: algoliaRecord.title,
        taskID: data.taskID,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in algolia-sync edge function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
