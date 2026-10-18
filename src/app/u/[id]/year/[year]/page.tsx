import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicYearView } from "./PublicYearView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; year: string }>;
}): Promise<Metadata> {
  const { id, year: yearStr } = await params;
  const parsedYear = parseInt(yearStr, 10);
  if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
    return {
      title: "Year in Review",
      robots: { index: false, follow: false },
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return {
      title: "Year in Review",
      robots: { index: false, follow: false },
    };
  }

  // 1. Verify shared_years row exists using normal client
  const { data: shared } = await supabase
    .from("shared_years")
    .select("year")
    .eq("user_id", id)
    .eq("year", parsedYear)
    .maybeSingle();

  if (!shared) {
    return {
      title: "Year in Review",
      robots: { index: false, follow: false },
    };
  }

  // 2. Verify profile is readable using normal client (hidden profiles return no row)
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    return {
      title: "Year in Review",
      robots: { index: false, follow: false },
    };
  }

  const displayName = profile.display_name || "User";
  const title = `${displayName}'s ${parsedYear} in review`;
  const description = `${displayName}'s ${parsedYear} in review`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title,
      description,
    },
  };
}

export default async function PublicYearPage({
  params,
}: {
  params: Promise<{ id: string; year: string }>;
}) {
  const { id, year: yearStr } = await params;
  const parsedYear = parseInt(yearStr, 10);

  if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
    notFound();
  }

  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }

  // 1. Return normal "not found" page unless a shared_years row exists for that user and year
  const { data: sharedRow, error: sharedError } = await supabase
    .from("shared_years")
    .select("year")
    .eq("user_id", id)
    .eq("year", parsedYear)
    .maybeSingle();

  if (sharedError || !sharedRow) {
    notFound();
  }

  // 2. Return "not found" if profile is not readable (hidden profile returns no row under existing policy)
  // Show only display_name and avatar_url for the person, never email or any other profile field
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (profileError || !profileRow) {
    notFound();
  }

  // 3. Compute recap strictly from entries WHERE user_id = id AND privacy = 'public' only
  // (even when the viewer is the owner)
  const { data: entries, error: entriesError } = await supabase
    .from("entries")
    .select(`
      id,
      user_id,
      media_id,
      status,
      rating,
      completed_at,
      created_at,
      privacy,
      media (
        id,
        type,
        title,
        cover_url,
        genres
      )
    `)
    .eq("user_id", id)
    .eq("privacy", "public");

  if (entriesError) {
    console.error("Public year recap entries fetch error:", entriesError);
    notFound();
  }

  const allRows = entries || [];

  // Filter entries for target year using: completed_at if set, otherwise created_at
  const yearEntries = allRows.filter((row) => {
    const dateStr = row.completed_at || row.created_at;
    if (!dateStr) return false;
    const y = new Date(dateStr).getUTCFullYear();
    return y === parsedYear;
  });

  const byType: {
    movie: number;
    tv: number;
    game: number;
    book: number;
  } = {
    movie: 0,
    tv: 0,
    game: 0,
    book: 0,
  };

  const genreMap: Record<string, number> = {};
  let completedCount = 0;
  let ratedCount = 0;
  let totalRatingSum = 0;

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

    const rawType = media?.type;
    const mediaType: "movie" | "tv" | "game" | "book" =
      rawType === "tv" || rawType === "game" || rawType === "book" ? rawType : "movie";
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

  const recapData = {
    year: parsedYear,
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
  };

  const safePerson = {
    id,
    display_name: profileRow.display_name,
    avatar_url: profileRow.avatar_url,
  };

  return <PublicYearView recap={recapData} person={safePerson} />;
}
