import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrendingSection } from "@/components/home/TrendingSection";
import { PopularRightNowSection } from "@/components/home/PopularRightNowSection";
import { HomeDashboardClient } from "@/components/home/HomeDashboardClient";
import type { MediaItem, MediaType } from "@/types/database.types";

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const VALID_TYPES: readonly MediaType[] = ["movie", "tv", "game", "book"];

async function getTrendingMediaData(typeParam?: string): Promise<{
  heading: "Trending now" | "Popular and new";
  items: MediaItem[];
  activeType: string;
}> {
  const normalizedType = (typeParam || "").toLowerCase().trim();
  const activeType: MediaType | "all" = (VALID_TYPES as readonly string[]).includes(normalizedType)
    ? (normalizedType as MediaType)
    : "all";

  const supabase = createAdminClient() || (await createClient());
  if (!supabase) {
    return { heading: "Trending now", items: [], activeType };
  }

  // 1. Fetch trending items from public.trending joined to public.media
  let query = supabase
    .from("trending")
    .select("media_id, type, entry_count, rank, media:media_id (*)");

  if (activeType !== "all") {
    query = query.eq("type", activeType).order("rank", { ascending: true });
  } else {
    // "All" shows the top 12 across types ordered by entry_count descending, then rank.
    query = query
      .order("entry_count", { ascending: false })
      .order("rank", { ascending: true });
  }

  const { data: trendingRaw, error } = await query.limit(12);

  const trendingMediaItems: MediaItem[] = [];

  if (!error && Array.isArray(trendingRaw)) {
    for (const row of trendingRaw) {
      const m = (row as unknown as { media?: MediaItem | MediaItem[] | null }).media;
      if (m) {
        trendingMediaItems.push(Array.isArray(m) ? m[0] : m);
      }
    }
  }

  // Fallback if PostgREST join returned records but media field wasn't populated or threw error
  if (
    trendingMediaItems.length === 0 &&
    !error &&
    Array.isArray(trendingRaw) &&
    trendingRaw.length > 0
  ) {
    const ids = trendingRaw.map((r) => r.media_id);
    const { data: mediaRows } = await supabase.from("media").select("*").in("id", ids);
    if (mediaRows) {
      const map = new Map(mediaRows.map((m) => [m.id, m]));
      for (const r of trendingRaw) {
        const item = map.get(r.media_id);
        if (item) trendingMediaItems.push(item);
      }
    }
  } else if (error) {
    // Query without join if relationship wasn't recognized
    let fallbackQuery = supabase
      .from("trending")
      .select("media_id, type, entry_count, rank");
    if (activeType !== "all") {
      fallbackQuery = fallbackQuery
        .eq("type", activeType)
        .order("rank", { ascending: true });
    } else {
      fallbackQuery = fallbackQuery
        .order("entry_count", { ascending: false })
        .order("rank", { ascending: true });
    }
    const { data: unjoinedTrending } = await fallbackQuery.limit(12);
    if (unjoinedTrending && unjoinedTrending.length > 0) {
      const ids = unjoinedTrending.map((r) => r.media_id);
      const { data: mediaRows } = await supabase.from("media").select("*").in("id", ids);
      if (mediaRows) {
        const map = new Map(mediaRows.map((m) => [m.id, m]));
        for (const r of unjoinedTrending) {
          const item = map.get(r.media_id);
          if (item) trendingMediaItems.push(item);
        }
      }
    }
  }

  const trendingCount = trendingMediaItems.length;
  const items: MediaItem[] = [...trendingMediaItems];
  let hadFallback = false;

  // 3. Sparse-data fallback: if fewer than 4 trending rows, fill remaining slots up to 12
  if (trendingCount < 4) {
    const slotsNeeded = 12 - trendingCount;
    if (slotsNeeded > 0) {
      let mediaQuery = supabase.from("media").select("*");

      if (activeType !== "all") {
        mediaQuery = mediaQuery.eq("type", activeType);
      }

      // Exclude titles already shown
      const shownIds = items.map((i) => i.id);
      if (shownIds.length > 0) {
        mediaQuery = mediaQuery.not("id", "in", `(${shownIds.join(",")})`);
      }

      mediaQuery = mediaQuery
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .limit(slotsNeeded);

      const { data: fallbackRows, error: fallbackErr } = await mediaQuery;

      if (!fallbackErr && fallbackRows && fallbackRows.length > 0) {
        items.push(...(fallbackRows as MediaItem[]));
        hadFallback = true;
      }
    }
  }

  // When any fallback titles are shown, change heading from "Trending now" to "Popular and new"
  const heading: "Trending now" | "Popular and new" = hadFallback
    ? "Popular and new"
    : "Trending now";

  return { heading, items, activeType };
}

async function getExternalTrendingData(
  popularTypeParam?: string,
  generalTypeParam?: string
): Promise<{
  items: MediaItem[];
  activeType: "movie" | "tv" | "game";
}> {
  const normalized = (popularTypeParam || "").toLowerCase().trim();
  let activeType: "movie" | "tv" | "game" = "movie";
  if (normalized === "tv") {
    activeType = "tv";
  } else if (normalized === "game") {
    activeType = "game";
  } else if (normalized === "movie") {
    activeType = "movie";
  } else if (generalTypeParam === "tv") {
    activeType = "tv";
  } else if (generalTypeParam === "game") {
    activeType = "game";
  }

  const supabase = createAdminClient() || (await createClient());
  if (!supabase) {
    return { items: [], activeType };
  }

  // Read from public.external_trending joined to public.media, ordered by rank
  const { data: raw, error } = await supabase
    .from("external_trending")
    .select("media_id, type, rank, source, media:media_id (*)")
    .eq("type", activeType)
    .order("rank", { ascending: true })
    .limit(20);

  const items: MediaItem[] = [];

  if (!error && Array.isArray(raw)) {
    for (const row of raw) {
      const m = (row as unknown as { media?: MediaItem | MediaItem[] | null }).media;
      if (m) {
        items.push(Array.isArray(m) ? m[0] : m);
      }
    }
  }

  // Fallback if PostgREST join wasn't resolved by foreign key cache
  if (items.length === 0 && !error && Array.isArray(raw) && raw.length > 0) {
    const ids = raw.map((r) => r.media_id);
    const { data: mediaRows } = await supabase.from("media").select("*").in("id", ids);
    if (mediaRows) {
      const map = new Map(mediaRows.map((m) => [m.id, m]));
      for (const r of raw) {
        const item = map.get(r.media_id);
        if (item) items.push(item);
      }
    }
  } else if (error) {
    const { data: unjoined } = await supabase
      .from("external_trending")
      .select("media_id, type, rank, source")
      .eq("type", activeType)
      .order("rank", { ascending: true })
      .limit(20);

    if (unjoined && unjoined.length > 0) {
      const ids = unjoined.map((r) => r.media_id);
      const { data: mediaRows } = await supabase.from("media").select("*").in("id", ids);
      if (mediaRows) {
        const map = new Map(mediaRows.map((m) => [m.id, m]));
        for (const r of unjoined) {
          const item = map.get(r.media_id);
          if (item) items.push(item);
        }
      }
    }
  }

  return { items, activeType };
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const rawType = Array.isArray(resolvedParams?.type)
    ? resolvedParams?.type[0]
    : resolvedParams?.type;

  const rawPopularType = Array.isArray(resolvedParams?.popular_type)
    ? resolvedParams?.popular_type[0]
    : resolvedParams?.popular_type;

  const rawDeleted = Array.isArray(resolvedParams?.deleted)
    ? resolvedParams?.deleted[0]
    : resolvedParams?.deleted;

  const rawMessage = Array.isArray(resolvedParams?.message)
    ? resolvedParams?.message[0]
    : resolvedParams?.message;

  const isDeleted =
    rawDeleted === "true" ||
    rawMessage === "Your account and data have been deleted.";

  const { heading, items, activeType } = await getTrendingMediaData(rawType);
  const { items: popularItems, activeType: activePopularType } =
    await getExternalTrendingData(rawPopularType, rawType);

  return (
    <HomeDashboardClient
      deletedBanner={isDeleted}
      trendingSection={
        <TrendingSection
          heading={heading}
          items={items}
          activeType={activeType}
        />
      }
      popularSection={
        <PopularRightNowSection
          items={popularItems}
          activeType={activePopularType}
          currentSearchParams={resolvedParams as Record<string, string | string[] | undefined>}
        />
      }
    />
  );
}
