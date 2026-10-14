import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/TopNav";
import { MediaDetailHeader } from "@/components/media/MediaDetailHeader";
import { WatchProvidersSection } from "@/components/media/WatchProvidersSection";
import { CastCrewSection } from "@/components/media/CastCrewSection";
import { GameDetailsSection } from "@/components/media/GameDetailsSection";
import { BookDetailsSection } from "@/components/media/BookDetailsSection";
import { MediaReviewsFeed } from "@/components/media/MediaReviewsFeed";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { indexMediaItem } from "@/lib/algolia";
import { fetchTMDBDetails } from "@/lib/tmdb";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import { fetchGoogleBookDetails, bookToMediaPayload } from "@/lib/google-books";
import type {
  MediaItem,
  MediaType,
  CastMember,
  CrewMember,
  WatchProvidersCountry,
  Json,
} from "@/types/database.types";
import { Coffee, Film, ArrowLeft, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Image from "next/image";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Checks the existing catalog for a media record by UUID or external provider IDs.
 * Does NOT perform external API network calls or database writes.
 */
async function getCatalogMedia(id: string): Promise<MediaItem | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (isUuid) {
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) return data as MediaItem;
  }

  // 1. Books: "book-" or "gb-"
  if (id.startsWith("book-") || id.startsWith("gb-")) {
    const bookId = id.replace(/^(book-|gb-)/i, "");
    const { data: byBook } = await supabase
      .from("media")
      .select("*")
      .filter("external_ids->>google_books_id", "eq", bookId)
      .maybeSingle();

    if (byBook) return byBook as MediaItem;
  }

  // 2. Games: "game-" or "rawg-"
  if (id.startsWith("game-") || id.startsWith("rawg-")) {
    const rawgId = id.replace(/^(game-|rawg-)/, "");
    const { data: byRawg } = await supabase
      .from("media")
      .select("*")
      .filter("external_ids->>rawg_id", "eq", String(rawgId))
      .maybeSingle();

    if (byRawg) return byRawg as MediaItem;
  }

  // 3. Movies / TV / numeric TMDB
  let numericId: number | null = null;
  let type: "movie" | "tv" | "game" = "movie";

  if (id.startsWith("movie-")) {
    numericId = parseInt(id.replace("movie-", ""), 10);
    type = "movie";
  } else if (id.startsWith("tv-")) {
    numericId = parseInt(id.replace("tv-", ""), 10);
    type = "tv";
  } else if (/^\d+$/.test(id)) {
    numericId = parseInt(id, 10);
  }

  if (numericId && !isNaN(numericId)) {
    const { data: byTmdb } = await supabase
      .from("media")
      .select("*")
      .filter("external_ids->>tmdb_id", "eq", String(numericId))
      .eq("type", type)
      .maybeSingle();

    if (byTmdb) return byTmdb as MediaItem;

    const { data: byRawg } = await supabase
      .from("media")
      .select("*")
      .filter("external_ids->>rawg_id", "eq", String(numericId))
      .maybeSingle();

    if (byRawg) return byRawg as MediaItem;
  }

  return null;
}

/**
 * Fetches and saves an uncached title using service-role client.
 * Strictly applies the same input validation guards as the sync routes.
 */
async function fetchAndSaveUncachedMedia(id: string): Promise<MediaItem | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  // 1. Books: "book-" or "gb-"
  if (id.startsWith("book-") || id.startsWith("gb-")) {
    const rawId = id.replace(/^(book-|gb-)/i, "").trim();

    // Input validation: volume ID must be 4-64 alphanumeric/dash/underscore chars or positive integer in sane range
    const isNumeric = /^\d+$/.test(rawId);
    let isValidId = false;

    if (isNumeric) {
      const numId = Number(rawId);
      isValidId = Number.isInteger(numId) && numId >= 1 && numId <= 10_000_000;
    } else {
      isValidId =
        rawId.length >= 4 &&
        rawId.length <= 64 &&
        /^[a-zA-Z0-9_\-]+$/.test(rawId);
    }

    if (!isValidId) return null;

    const { data: bookDetails, error: bookErr } = await fetchGoogleBookDetails(rawId);
    if (bookErr || !bookDetails) return null;

    const payload = bookToMediaPayload(bookDetails);
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>google_books_id", "eq", bookDetails.google_books_id)
      .limit(1);

    const existingId = existingRows?.[0]?.id;
    let savedMedia: MediaItem | null = null;

    if (existingId) {
      const { data: updated } = await supabase
        .from("media")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single();
      savedMedia = updated as MediaItem | null;
    } else {
      const { data: inserted } = await supabase
        .from("media")
        .insert(payload)
        .select()
        .single();
      savedMedia = inserted as MediaItem | null;
    }

    if (savedMedia) {
      try {
        await indexMediaItem(savedMedia);
      } catch (algoliaErr) {
        console.warn("Algolia indexing skipped for uncached book:", algoliaErr);
      }
      return savedMedia;
    }

    return null;
  }

  // 2. Games: "game-" or "rawg-"
  if (id.startsWith("game-") || id.startsWith("rawg-")) {
    const rawId = id.replace(/^(game-|rawg-)/, "").trim();
    const idNum = Number(rawId);

    // Input validation: must be a positive integer between 1 and 10,000,000
    if (!Number.isInteger(idNum) || idNum < 1 || idNum > 10_000_000) {
      return null;
    }

    const { data: gameDetails, error: rawgErr } = await fetchRAWGGameDetails(idNum);
    if (rawgErr || !gameDetails) return null;

    const payload = rawgGameToMediaPayload(gameDetails);
    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>rawg_id", "eq", String(gameDetails.rawg_id))
      .limit(1);

    const existingId = existingRows?.[0]?.id;
    let savedMedia: MediaItem | null = null;

    if (existingId) {
      const { data: updated } = await supabase
        .from("media")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single();
      savedMedia = updated as MediaItem | null;
    } else {
      const { data: inserted } = await supabase
        .from("media")
        .insert(payload)
        .select()
        .single();
      savedMedia = inserted as MediaItem | null;
    }

    if (savedMedia) {
      try {
        await indexMediaItem(savedMedia);
      } catch (algoliaErr) {
        console.warn("Algolia indexing skipped for uncached game:", algoliaErr);
      }
      return savedMedia;
    }

    return null;
  }

  // 3. Movies / TV / Numeric TMDB
  let numericId: number | null = null;
  let type: "movie" | "tv" = "movie";

  if (id.startsWith("movie-")) {
    numericId = parseInt(id.replace("movie-", ""), 10);
    type = "movie";
  } else if (id.startsWith("tv-")) {
    numericId = parseInt(id.replace("tv-", ""), 10);
    type = "tv";
  } else if (/^\d+$/.test(id)) {
    numericId = parseInt(id, 10);
  }

  // Input validation: must be a positive integer between 1 and 10,000,000
  if (
    numericId &&
    Number.isInteger(numericId) &&
    numericId >= 1 &&
    numericId <= 10_000_000
  ) {
    const { data: details, error: tmdbErr } = await fetchTMDBDetails(numericId, type);
    if (tmdbErr || !details) return null;

    const genreNames = Array.isArray(details.genres)
      ? details.genres
          .map((g) => (typeof g === "string" ? g : g.name))
          .filter(Boolean)
      : [];

    const payload = {
      type: details.type,
      title: details.title,
      cover_url: details.poster_url,
      release_date: details.release_date,
      genres: genreNames,
      synopsis: details.overview,
      type_specific: {
        runtime: details.runtime,
        tagline: details.tagline,
        original_title: details.original_title,
        status: details.status,
        backdrop_url: details.backdrop_url,
        number_of_seasons: details.number_of_seasons,
        number_of_episodes: details.number_of_episodes,
        cast: details.cast,
        crew: details.crew,
        credits: details.credits,
      } as unknown as Json,
      external_ids: {
        tmdb_id: details.tmdb_id,
        imdb_id: details.imdb_id,
      } as unknown as Json,
      watch_providers: details.watch_providers as unknown as Json,
      localized_fields: {
        original_language: details.original_language,
        spoken_languages: details.spoken_languages,
        production_companies: details.production_companies,
      } as unknown as Json,
      community_rating_avg: details.vote_average,
      community_rating_count: details.vote_count,
      last_synced_at: new Date().toISOString(),
    };

    const { data: existingRows } = await supabase
      .from("media")
      .select("id")
      .filter("external_ids->>tmdb_id", "eq", String(details.tmdb_id))
      .eq("type", type)
      .limit(1);

    const existingId = existingRows?.[0]?.id;
    let savedMedia: MediaItem | null = null;

    if (existingId) {
      const { data: updated } = await supabase
        .from("media")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single();
      savedMedia = updated as MediaItem | null;
    } else {
      const { data: inserted } = await supabase
        .from("media")
        .insert(payload)
        .select()
        .single();
      savedMedia = inserted as MediaItem | null;
    }

    if (savedMedia) {
      try {
        await indexMediaItem(savedMedia);
      } catch (algoliaErr) {
        console.warn("Algolia indexing skipped for uncached tmdb item:", algoliaErr);
      }
      return savedMedia;
    }
  }

  return null;
}

/**
 * Retrieves the current logged-in user's profile region if present.
 */
async function getUserRegion(): Promise<string> {
  try {
    const serverSupabase = await createClient();
    if (!serverSupabase) return "US";

    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) return "US";

    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("region")
      .eq("id", user.id)
      .maybeSingle();

    return profile?.region || "US";
  } catch {
    return "US";
  }
}

/**
 * Queries public.media for other rows of the same type with overlapping genres,
 * ranked by number of shared genres, excluding the current title, limit 8.
 */
async function getSimilarMedia(
  currentId: string,
  type: MediaType,
  genres: string[]
): Promise<MediaItem[]> {
  if (!genres || !Array.isArray(genres) || genres.length === 0) {
    return [];
  }

  const validGenres = genres.filter(
    (g) => typeof g === "string" && g.trim().length > 0
  );
  if (validGenres.length === 0) {
    return [];
  }

  const supabase = createAdminClient() || (await createClient());
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("type", type)
    .neq("id", currentId)
    .overlaps("genres", validGenres)
    .limit(50);

  if (error || !data || data.length === 0) {
    return [];
  }

  const currentGenreSet = new Set(
    validGenres.map((g) => g.toLowerCase().trim())
  );

  const scored = (data as MediaItem[]).map((item) => {
    const itemGenres = Array.isArray(item.genres) ? item.genres : [];
    let sharedCount = 0;
    for (const g of itemGenres) {
      if (typeof g === "string" && currentGenreSet.has(g.toLowerCase().trim())) {
        sharedCount++;
      }
    }
    return { item, sharedCount };
  });

  const matches = scored.filter((s) => s.sharedCount > 0);

  matches.sort((a, b) => {
    if (b.sharedCount !== a.sharedCount) {
      return b.sharedCount - a.sharedCount;
    }
    const aRating = a.item.community_rating_avg;
    const bRating = b.item.community_rating_avg;
    if (aRating == null && bRating == null) return 0;
    if (aRating == null) return 1;
    if (bRating == null) return -1;
    return bRating - aRating;
  });

  return matches.slice(0, 8).map((s) => s.item);
}

/**
 * Generate rich SEO metadata for the title page.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const media = await getCatalogMedia(id);

  if (!media) {
    return {
      title: "Title Page — meDiary",
      description: "Explore details, cast, reviews, and watch providers on meDiary.",
    };
  }

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : null;
  const titleString = year ? `${media.title} (${year})` : media.title;

  return {
    title: `${titleString} — meDiary`,
    description:
      media.synopsis ||
      `Explore cast, crew, details, and watch providers for ${media.title} on meDiary.`,
    openGraph: {
      title: `${titleString} — meDiary`,
      description: media.synopsis || `Explore details for ${media.title}.`,
      images: media.cover_url ? [{ url: media.cover_url }] : [],
    },
  };
}

export default async function MediaDetailPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Check if title is already in catalog
  const cachedMedia = await getCatalogMedia(id);

  let media: MediaItem | null = cachedMedia;
  let requiresAuth = false;

  if (!media) {
    // 2. Title is uncached: verify visitor is verified signed in
    const serverSupabase = await createClient();
    const {
      data: { user },
    } = serverSupabase
      ? await serverSupabase.auth.getUser()
      : { data: { user: null } };

    if (!user) {
      // Unauthenticated visitor trying to view an uncached title: show "sign in to add this title" state
      requiresAuth = true;
    } else {
      // Authenticated visitor: apply strict sync route validation, fetch from external provider and save
      media = await fetchAndSaveUncachedMedia(id);
    }
  }

  const userRegion = await getUserRegion();

  // Visitor not signed in attempting to access an uncached title
  if (requiresAuth) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <TopNav />
        <main className="flex-1 max-w-xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border/80 flex items-center justify-center text-accent mb-5 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text mb-2.5">
            Sign in to add this title
          </h1>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mb-8">
            This title hasn&apos;t been added to the catalog yet. Sign in or create an account to discover and archive it in your meDiary journal.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="md"
                leftIcon={<LogIn className="w-4 h-4" />}
                className="w-full sm:w-auto justify-center"
              >
                Sign In to Add Title
              </Button>
            </Link>
            <Link href="/" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                className="w-full sm:w-auto justify-center"
              >
                Return to Catalog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <TopNav />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted mb-4 shadow-xs">
            <Film className="w-8 h-8 opacity-50" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-text mb-2">
            Title Not Found
          </h1>
          <p className="text-sm text-text-muted max-w-md mb-6">
            We couldn&apos;t find this media item in your catalog or on external providers. Check the URL or search for another title using the top search bar.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Return to Catalog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const similarMedia = await getSimilarMedia(
    media.id,
    media.type,
    media.genres
  );

  const typeSpecific = (media.type_specific as Record<string, unknown>) || {};
  const cast = (Array.isArray(typeSpecific.cast)
    ? typeSpecific.cast
    : []) as CastMember[];
  const crew = (Array.isArray(typeSpecific.crew)
    ? typeSpecific.crew
    : []) as CrewMember[];
  const watchProviders =
    (media.watch_providers as Record<string, WatchProvidersCountry>) || {};

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      {/* Universal Top Navigation */}
      <TopNav />

      <main className="flex-1 pb-20">
        {/* Editorial Header / Hero Section */}
        <MediaDetailHeader media={media} />

        {/* Detail Sections Container with generous desktop breathing room */}
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-12 pt-8 sm:pt-16 pb-16 sm:pb-24 space-y-10 sm:space-y-18 lg:space-y-20">
          {media.type === "book" ? (
            /* Book Title Page Sections: Edition, Author, Pages, ISBN */
            <BookDetailsSection media={media} />
          ) : media.type === "game" ? (
            /* Game Title Page Sections: Specs, Platforms, Studios, Screenshots */
            <GameDetailsSection media={media} />
          ) : (
            /* Movie/TV Sections: Where to Watch & Full Cast and Crew */
            <>
              <WatchProvidersSection
                watchProviders={watchProviders}
                defaultRegion={userRegion}
              />
              <CastCrewSection cast={cast} crew={crew} />
            </>
          )}

          {/* More like this Recommendations Panel */}
          {similarMedia.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
                  More like this
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
                {similarMedia.map((item) => (
                  <Link
                    key={item.id}
                    href={`/media/${encodeURIComponent(item.id)}`}
                    className="group block h-full focus-visible:outline-none"
                  >
                    <Card
                      variant="interactive"
                      className="p-2.5 sm:p-3 flex flex-col h-full bg-surface hover:border-accent transition-all"
                    >
                      <div className="relative aspect-2/3 w-full rounded-xl overflow-hidden bg-bg/80 shrink-0 poster-depth-sm mb-2.5">
                        {item.cover_url ? (
                          <Image
                            src={item.cover_url}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 12vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted font-serif text-xs font-semibold p-1 text-center">
                            {item.title ? item.title.slice(0, 2).toUpperCase() : "??"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-xs sm:text-sm font-bold text-text group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                          {item.title}
                        </h3>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Community Public Reviews Feed (with spoiler shields & sorting) */}
          <MediaReviewsFeed media={media} />

          {/* Catalog Sync Metadata Footer */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 card-depth rounded-2xl text-xs text-text-muted">
            <div className="flex items-center gap-2.5">
              <Coffee className="w-4 h-4 text-accent shrink-0" />
              <span>
                Archived in your meDiary catalog · Database ID:{" "}
                <code className="font-mono text-[11px] text-text">
                  {media.id}
                </code>
              </span>
            </div>

            {media.last_synced_at && (
              <span className="text-[11px] font-mono">
                Last synced:{" "}
                {new Date(media.last_synced_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

