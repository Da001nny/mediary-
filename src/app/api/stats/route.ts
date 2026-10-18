import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Compute stats strictly from entries WHERE user_id = user.id, joined to media
    const { data: entries, error: dbError } = await supabase
      .from("entries")
      .select(`
        id,
        user_id,
        status,
        rating,
        created_at,
        completed_at,
        media (
          id,
          type,
          title,
          genres
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("GET /api/stats db error:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch user entries for statistics" },
        { status: 500 }
      );
    }

    const rows = entries || [];

    // 1. Total entries and counts by media type
    const byType: Record<string, number> = {
      movie: 0,
      tv: 0,
      game: 0,
      book: 0,
    };

    // 2. Top 8 genres across user's entries
    const genreMap: Record<string, number> = {};

    // 3. Rating distribution in 10 buckets over 0-100 stored rating
    const ratingBuckets = [
      { bucket: "0-10", min: 0, max: 10, count: 0 },
      { bucket: "11-20", min: 11, max: 20, count: 0 },
      { bucket: "21-30", min: 21, max: 30, count: 0 },
      { bucket: "31-40", min: 31, max: 40, count: 0 },
      { bucket: "41-50", min: 41, max: 50, count: 0 },
      { bucket: "51-60", min: 51, max: 60, count: 0 },
      { bucket: "61-70", min: 61, max: 70, count: 0 },
      { bucket: "71-80", min: 71, max: 80, count: 0 },
      { bucket: "81-90", min: 81, max: 90, count: 0 },
      { bucket: "91-100", min: 91, max: 100, count: 0 },
    ];

    let totalRatingSum = 0;
    let ratedCount = 0;

    // 4. Status counts
    const statusCounts: Record<string, number> = {
      planned: 0,
      in_progress: 0,
      completed: 0,
      dropped: 0,
      on_hold: 0,
    };

    // 5. Entries per month for the last 12 months (by created_at)
    const now = new Date();
    const monthsList: Array<{ key: string; label: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}`;
      const label = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      monthsList.push({ key, label, count: 0 });
    }

    for (const entry of rows) {
      // Type breakdown
      const media = entry.media as unknown as { type?: string; genres?: string[] } | null;
      const mediaType = media?.type || "movie";
      byType[mediaType] = (byType[mediaType] || 0) + 1;

      // Genres
      if (media?.genres && Array.isArray(media.genres)) {
        for (const g of media.genres) {
          if (typeof g === "string" && g.trim()) {
            const cleanG = g.trim();
            genreMap[cleanG] = (genreMap[cleanG] || 0) + 1;
          }
        }
      }

      // Rating
      if (entry.rating !== null && entry.rating !== undefined) {
        const r = Number(entry.rating);
        if (!isNaN(r) && r >= 0 && r <= 100) {
          ratedCount++;
          totalRatingSum += r;
          if (r <= 10) ratingBuckets[0].count++;
          else if (r <= 20) ratingBuckets[1].count++;
          else if (r <= 30) ratingBuckets[2].count++;
          else if (r <= 40) ratingBuckets[3].count++;
          else if (r <= 50) ratingBuckets[4].count++;
          else if (r <= 60) ratingBuckets[5].count++;
          else if (r <= 70) ratingBuckets[6].count++;
          else if (r <= 80) ratingBuckets[7].count++;
          else if (r <= 90) ratingBuckets[8].count++;
          else ratingBuckets[9].count++;
        }
      }

      // Status
      if (entry.status && statusCounts[entry.status] !== undefined) {
        statusCounts[entry.status]++;
      }

      // Monthly
      if (entry.created_at) {
        const entryDate = new Date(entry.created_at);
        const y = entryDate.getUTCFullYear();
        const m = String(entryDate.getUTCMonth() + 1).padStart(2, "0");
        const key = `${y}-${m}`;
        const targetMonth = monthsList.find((item) => item.key === key);
        if (targetMonth) {
          targetMonth.count++;
        }
      }
    }

    const topGenres = Object.entries(genreMap)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const averageRating =
      ratedCount > 0 ? Math.round((totalRatingSum / ratedCount) * 10) / 10 : null;

    return NextResponse.json({
      total: rows.length,
      byType,
      typeBreakdown: [
        { type: "movie", label: "Movies", count: byType.movie || 0 },
        { type: "tv", label: "TV Shows", count: byType.tv || 0 },
        { type: "game", label: "Games", count: byType.game || 0 },
        { type: "book", label: "Books", count: byType.book || 0 },
      ],
      topGenres,
      ratingDistribution: ratingBuckets,
      averageRating,
      ratedCount,
      monthly: monthsList,
      statusCounts: {
        planned: statusCounts.planned || 0,
        in_progress: statusCounts.in_progress || 0,
        completed: statusCounts.completed || 0,
        dropped: statusCounts.dropped || 0,
        on_hold: statusCounts.on_hold || 0,
      },
      statusBreakdown: [
        { status: "completed", label: "Completed", count: statusCounts.completed || 0 },
        { status: "in_progress", label: "In Progress", count: statusCounts.in_progress || 0 },
        { status: "planned", label: "Planned", count: statusCounts.planned || 0 },
        { status: "on_hold", label: "On Hold", count: statusCounts.on_hold || 0 },
        { status: "dropped", label: "Dropped", count: statusCounts.dropped || 0 },
      ],
    });
  } catch (err: unknown) {
    console.error("GET /api/stats unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
