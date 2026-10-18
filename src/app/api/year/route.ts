import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

    // Determine target year from query parameter (default: current year)
    const currentYear = new Date().getUTCFullYear();
    const yearParam = request.nextUrl.searchParams.get("year");
    let targetYear = currentYear;
    if (yearParam) {
      const parsed = parseInt(yearParam, 10);
      if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2100) {
        targetYear = parsed;
      }
    }

    // Compute everything from entries WHERE user_id = user.id, joined to media
    // Never accept a user id from the request.
    const { data: entries, error: dbError } = await supabase
      .from("entries")
      .select(`
        id,
        user_id,
        media_id,
        status,
        rating,
        completed_at,
        created_at,
        media (
          id,
          type,
          title,
          cover_url,
          genres
        )
      `)
      .eq("user_id", user.id);

    if (dbError) {
      console.error("GET /api/year db error:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch user entries for year in review" },
        { status: 500 }
      );
    }

    const allRows = entries || [];

    // The list of years that have at least one entry (for a year picker)
    const yearsSet = new Set<number>();
    for (const row of allRows) {
      const dateStr = row.completed_at || row.created_at;
      if (dateStr) {
        const y = new Date(dateStr).getUTCFullYear();
        if (!isNaN(y)) {
          yearsSet.add(y);
        }
      }
    }

    // Always ensure at least the current year is in availableYears
    yearsSet.add(currentYear);
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

    // Keep entries whose effective date falls in the requested year:
    // (using completed_at if set, otherwise created_at)
    const yearEntries = allRows.filter((row) => {
      const dateStr = row.completed_at || row.created_at;
      if (!dateStr) return false;
      const y = new Date(dateStr).getUTCFullYear();
      return y === targetYear;
    });

    // 1. Total entries and counts by media type, plus most-logged type
    const byType: Record<string, number> = {
      movie: 0,
      tv: 0,
      game: 0,
      book: 0,
    };

    const genreMap: Record<string, number> = {};
    let completedCount = 0;
    let ratedCount = 0;
    let totalRatingSum = 0;

    // 2. Entries per month for all 12 months
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthShortLabels = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const monthly = monthNames.map((name, index) => ({
      month: index + 1,
      name,
      label: monthShortLabels[index],
      count: 0,
    }));

    for (const entry of yearEntries) {
      const media = entry.media as unknown as {
        id?: string;
        type?: string;
        title?: string;
        cover_url?: string | null;
        genres?: string[];
      } | null;

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

      // Status
      if (entry.status === "completed") {
        completedCount++;
      }

      // Rating (ignoring unrated entries)
      if (entry.rating !== null && entry.rating !== undefined) {
        const r = Number(entry.rating);
        if (!isNaN(r) && r >= 0 && r <= 100) {
          ratedCount++;
          totalRatingSum += r;
        }
      }

      // Month
      const dateStr = entry.completed_at || entry.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        const mIdx = d.getUTCMonth();
        if (mIdx >= 0 && mIdx < 12) {
          monthly[mIdx].count++;
        }
      }
    }

    // Determine most-logged type
    let mostLoggedType: string | null = null;
    let maxTypeCount = 0;
    for (const [type, count] of Object.entries(byType)) {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        mostLoggedType = type;
      }
    }

    // Top 5 genres
    const topGenres = Object.entries(genreMap)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // The 5 highest-rated titles: (title, cover, type, rating), ignoring unrated entries,
    // ties broken by most recent effective date
    const ratedEntries = yearEntries.filter((e) => {
      if (e.rating === null || e.rating === undefined) return false;
      const r = Number(e.rating);
      return !isNaN(r) && r >= 0 && r <= 100;
    });

    ratedEntries.sort((a, b) => {
      const rA = Number(a.rating);
      const rB = Number(b.rating);
      if (rB !== rA) {
        return rB - rA;
      }
      const timeA = new Date(a.completed_at || a.created_at).getTime();
      const timeB = new Date(b.completed_at || b.created_at).getTime();
      return timeB - timeA;
    });

    const topRatedTitles = ratedEntries.slice(0, 5).map((entry) => {
      const media = entry.media as unknown as {
        id?: string;
        type?: string;
        title?: string;
        cover_url?: string | null;
      } | null;

      return {
        id: entry.id,
        media_id: entry.media_id,
        title: media?.title || "Untitled",
        cover: media?.cover_url || null,
        type: media?.type || "movie",
        rating: Number(entry.rating),
        date: entry.completed_at || entry.created_at,
      };
    });

    // Average rating
    const averageRating =
      ratedCount > 0 ? Math.round((totalRatingSum / ratedCount) * 10) / 10 : null;

    // Busiest month
    let busiestMonth: {
      month: number;
      name: string;
      label: string;
      count: number;
    } | null = null;

    let maxMonthCount = 0;
    for (const m of monthly) {
      if (m.count > maxMonthCount) {
        maxMonthCount = m.count;
        busiestMonth = m;
      }
    }

    return NextResponse.json({
      year: targetYear,
      total: yearEntries.length,
      byType,
      typeBreakdown: [
        { type: "movie", label: "Movies", count: byType.movie || 0 },
        { type: "tv", label: "TV Shows", count: byType.tv || 0 },
        { type: "game", label: "Games", count: byType.game || 0 },
        { type: "book", label: "Books", count: byType.book || 0 },
      ],
      mostLoggedType,
      topGenres,
      topRatedTitles,
      averageRating,
      ratedCount,
      completedCount,
      busiestMonth,
      monthly,
      availableYears,
    });
  } catch (err: unknown) {
    console.error("GET /api/year unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
