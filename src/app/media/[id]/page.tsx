import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/TopNav";
import { MediaDetailHeader } from "@/components/media/MediaDetailHeader";
import { WatchProvidersSection } from "@/components/media/WatchProvidersSection";
import { CastCrewSection } from "@/components/media/CastCrewSection";
import { GameDetailsSection } from "@/components/media/GameDetailsSection";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchTMDBDetails } from "@/lib/tmdb";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import type {
  MediaItem,
  CastMember,
  CrewMember,
  WatchProvidersCountry,
  Json,
} from "@/types/database.types";
import { Coffee, Film, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Loads a media record by UUID, TMDB ID, RAWG ID, or auto-syncs on-demand.
 */
async function getMedia(id: string): Promise<MediaItem | null> {
  const supabase = createAdminClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (isUuid && supabase) {
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) return data as MediaItem;
  }

  // 1. Check for Game prefixes: "game-3498" or "rawg-3498"
  if (id.startsWith("game-") || id.startsWith("rawg-")) {
    const rawgId = id.replace(/^(game-|rawg-)/, "");
    if (supabase) {
      const { data: byRawg } = await supabase
        .from("media")
        .select("*")
        .filter("external_ids->>rawg_id", "eq", String(rawgId))
        .maybeSingle();

      if (byRawg) return byRawg as MediaItem;
    }

    // Not in database: Fetch from RAWG and upsert
    const { data: gameDetails } = await fetchRAWGGameDetails(rawgId);
    if (gameDetails) {
      const payload = rawgGameToMediaPayload(gameDetails);

      if (supabase) {
        const { data: existingRows } = await supabase
          .from("media")
          .select("id")
          .filter("external_ids->>rawg_id", "eq", String(gameDetails.rawg_id))
          .limit(1);

        const existingId = existingRows?.[0]?.id;
        let upsertResult;
        if (existingId) {
          upsertResult = await supabase
            .from("media")
            .update(payload)
            .eq("id", existingId)
            .select()
            .single();
        } else {
          upsertResult = await supabase
            .from("media")
            .insert(payload)
            .select()
            .single();
        }

        if (upsertResult?.data) {
          return upsertResult.data as MediaItem;
        }
      }

      // Memory fallback for game
      return {
        id: `rawg-game-${gameDetails.rawg_id}`,
        ...payload,
      } as MediaItem;
    }
  }

  // 2. Parse if it's numeric or prefixed like "movie-550" or "tv-95557"
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
    if (supabase) {
      // 1. Try to find in database by external_ids->>tmdb_id
      const { data: byTmdb } = await supabase
        .from("media")
        .select("*")
        .filter("external_ids->>tmdb_id", "eq", String(numericId))
        .maybeSingle();

      if (byTmdb) return byTmdb as MediaItem;

      // 2. Try to find by RAWG ID
      const { data: byRawg } = await supabase
        .from("media")
        .select("*")
        .filter("external_ids->>rawg_id", "eq", String(numericId))
        .maybeSingle();

      if (byRawg) return byRawg as MediaItem;
    }

    // 3. Not in database yet: Fetch from TMDB
    const { data: details } = await fetchTMDBDetails(numericId, type);
    if (details) {
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

      if (supabase) {
        const { data: existingRows } = await supabase
          .from("media")
          .select("id")
          .filter("external_ids->>tmdb_id", "eq", String(details.tmdb_id))
          .limit(1);

        const existingId = existingRows?.[0]?.id;

        let upsertResult;
        if (existingId) {
          upsertResult = await supabase
            .from("media")
            .update(payload)
            .eq("id", existingId)
            .select()
            .single();
        } else {
          upsertResult = await supabase
            .from("media")
            .insert(payload)
            .select()
            .single();
        }

        if (upsertResult?.data) {
          return upsertResult.data as MediaItem;
        }
      }

      // Memory fallback: ensures page renders with complete metadata
      return {
        id: `tmdb-${details.type}-${details.tmdb_id}`,
        ...payload,
      } as MediaItem;
    }

    // 4. Try RAWG for numeric ID
    const { data: gameDetails } = await fetchRAWGGameDetails(numericId);
    if (gameDetails) {
      const payload = rawgGameToMediaPayload(gameDetails);
      if (supabase) {
        const { data: existingRows } = await supabase
          .from("media")
          .select("id")
          .filter("external_ids->>rawg_id", "eq", String(gameDetails.rawg_id))
          .limit(1);

        const existingId = existingRows?.[0]?.id;
        let upsertResult;
        if (existingId) {
          upsertResult = await supabase
            .from("media")
            .update(payload)
            .eq("id", existingId)
            .select()
            .single();
        } else {
          upsertResult = await supabase
            .from("media")
            .insert(payload)
            .select()
            .single();
        }

        if (upsertResult?.data) {
          return upsertResult.data as MediaItem;
        }
      }

      return {
        id: `rawg-game-${gameDetails.rawg_id}`,
        ...payload,
      } as MediaItem;
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
 * Generate rich SEO metadata for the title page.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const media = await getMedia(id);

  if (!media) {
    return {
      title: "Title Not Found — meDiary",
      description: "The requested media title could not be found in the catalog.",
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
  const [media, userRegion] = await Promise.all([getMedia(id), getUserRegion()]);

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
            We couldn&apos;t find this media item in your catalog or on TMDB. Check the URL or search for another title using the top search bar.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="primary" className="gap-2 text-xs">
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Catalog</span>
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

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

        {/* Detail Sections Container */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
          {media.type === "game" ? (
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

          {/* Catalog Sync Metadata Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface/50 rounded-lg border border-border/70 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-accent" />
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
