import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTMDBWeeklyTrending } from "@/lib/tmdb";
import { fetchRAWGTrendingGames } from "@/lib/rawg";
import {
  syncTMDBMovieToMedia,
  syncTMDBTVToMedia,
  syncRAWGGameToMedia,
} from "@/lib/import-service";

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
  let rawGames: Array<{ id: number }> = [];

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

  // Fetch top 20 games from RAWG (ordering=-added, covering last 12 months)
  try {
    rawGames = (await fetchRAWGTrendingGames(20)).slice(0, 20);
  } catch (err) {
    console.warn("Failed to fetch RAWG trending games:", err);
  }

  const syncedTMDBRows: Array<{
    media_id: string;
    type: "movie" | "tv";
    rank: number;
    source: string;
    computed_at: string;
  }> = [];

  const syncedGameRows: Array<{
    media_id: string;
    type: "game";
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
        syncedTMDBRows.push({
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
        syncedTMDBRows.push({
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

  // 5. Sync Games (top 20)
  for (let i = 0; i < rawGames.length; i++) {
    const item = rawGames[i];
    if (!item?.id) continue;
    try {
      const mediaId = await syncRAWGGameToMedia(item.id);
      if (mediaId) {
        syncedGameRows.push({
          media_id: mediaId,
          type: "game",
          rank: i + 1,
          source: "rawg",
          computed_at: now,
        });
      }
    } catch (err) {
      // Skip titles that fail; don't abort the run
      console.warn(`Failed to sync trending game ID ${item.id}:`, err);
    }
  }

  // 6. Store TMDB ordered list in public.external_trending
  if (syncedTMDBRows.length > 0) {
    const seenMediaIds = new Set<string>();
    const uniqueTMDBRows = syncedTMDBRows.filter((row) => {
      if (seenMediaIds.has(row.media_id)) return false;
      seenMediaIds.add(row.media_id);
      return true;
    });

    const { error: deleteErr } = await admin
      .from("external_trending")
      .delete()
      .eq("source", "tmdb");

    if (deleteErr) {
      console.warn("Error deleting old external_trending tmdb rows:", deleteErr);
    }

    const { error: insertErr } = await admin
      .from("external_trending")
      .insert(uniqueTMDBRows);

    if (insertErr) {
      console.error("Error inserting external_trending tmdb rows:", insertErr);
    }
  }

  // 7. Store RAWG ordered list in public.external_trending (clear and replace only source = 'rawg')
  if (syncedGameRows.length > 0) {
    const seenGameIds = new Set<string>();
    const uniqueGameRows = syncedGameRows.filter((row) => {
      if (seenGameIds.has(row.media_id)) return false;
      seenGameIds.add(row.media_id);
      return true;
    });

    const { error: deleteGamesErr } = await admin
      .from("external_trending")
      .delete()
      .eq("source", "rawg");

    if (deleteGamesErr) {
      console.warn("Error deleting old external_trending rawg rows:", deleteGamesErr);
    }

    const { error: insertGamesErr } = await admin
      .from("external_trending")
      .insert(uniqueGameRows);

    if (insertGamesErr) {
      console.error("Error inserting external_trending rawg rows:", insertGamesErr);
    }
  }

  return NextResponse.json({
    success: true,
    synced_movies: syncedTMDBRows.filter((r) => r.type === "movie").length,
    synced_tv: syncedTMDBRows.filter((r) => r.type === "tv").length,
    synced_games: syncedGameRows.length,
    total_stored: syncedTMDBRows.length + syncedGameRows.length,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
