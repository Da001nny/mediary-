import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTMDBWeeklyTrending } from "@/lib/tmdb";
import { syncTMDBMovieToMedia, syncTMDBTVToMedia } from "@/lib/import-service";

export const maxDuration = 120; // 2 minutes for external syncing

export async function GET(req: NextRequest) {
  // 1. Authorization check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database admin client unavailable" },
      { status: 500 }
    );
  }

  // 2. Fetch TMDB's weekly trending movies and TV (top 20 each)
  let rawMovies: Array<{ id: number }> = [];
  let rawTV: Array<{ id: number }> = [];

  try {
    rawMovies = (await fetchTMDBWeeklyTrending("movie")).slice(0, 20);
  } catch (err) {
    console.warn("Failed to fetch TMDB weekly trending movies:", err);
  }

  try {
    rawTV = (await fetchTMDBWeeklyTrending("tv")).slice(0, 20);
  } catch (err) {
    console.warn("Failed to fetch TMDB weekly trending TV:", err);
  }

  const syncedRows: Array<{
    media_id: string;
    type: "movie" | "tv";
    rank: number;
    source: string;
    computed_at: string;
  }> = [];

  const now = new Date().toISOString();

  // 3. Sync movies (top 20)
  for (let i = 0; i < rawMovies.length; i++) {
    const item = rawMovies[i];
    if (!item?.id) continue;
    try {
      const mediaId = await syncTMDBMovieToMedia(item.id);
      if (mediaId) {
        syncedRows.push({
          media_id: mediaId,
          type: "movie",
          rank: i + 1,
          source: "tmdb",
          computed_at: now,
        });
      }
    } catch (err) {
      // Skip titles that fail; don't abort the run
      console.warn(`Failed to sync trending movie ID ${item.id}:`, err);
    }
  }

  // 4. Sync TV (top 20)
  for (let i = 0; i < rawTV.length; i++) {
    const item = rawTV[i];
    if (!item?.id) continue;
    try {
      const mediaId = await syncTMDBTVToMedia(item.id);
      if (mediaId) {
        syncedRows.push({
          media_id: mediaId,
          type: "tv",
          rank: i + 1,
          source: "tmdb",
          computed_at: now,
        });
      }
    } catch (err) {
      // Skip titles that fail; don't abort the run
      console.warn(`Failed to sync trending TV ID ${item.id}:`, err);
    }
  }

  // 5. Store ordered list in public.external_trending
  if (syncedRows.length > 0) {
    // Deduplicate on (media_id, source)
    const seenMediaIds = new Set<string>();
    const uniqueRows = syncedRows.filter((row) => {
      if (seenMediaIds.has(row.media_id)) return false;
      seenMediaIds.add(row.media_id);
      return true;
    });

    const { error: deleteErr } = await admin
      .from("external_trending")
      .delete()
      .eq("source", "tmdb");

    if (deleteErr) {
      console.warn("Error deleting old external_trending rows:", deleteErr);
    }

    const { error: insertErr } = await admin
      .from("external_trending")
      .insert(uniqueRows);

    if (insertErr) {
      console.error("Error inserting external_trending rows:", insertErr);
      return NextResponse.json(
        { error: "Failed to store external trending rows", details: insertErr.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    synced_movies: syncedRows.filter((r) => r.type === "movie").length,
    synced_tv: syncedRows.filter((r) => r.type === "tv").length,
    total_stored: syncedRows.length,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
