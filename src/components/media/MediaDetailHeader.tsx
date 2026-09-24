"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Star,
  Film,
  Tv,
  BookmarkPlus,
  Share2,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MediaItem } from "@/types/database.types";

interface MediaDetailHeaderProps {
  media: MediaItem;
}

export function MediaDetailHeader({ media }: MediaDetailHeaderProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [loggedNotice, setLoggedNotice] = useState(false);

  const typeSpecific = (media.type_specific as Record<string, unknown>) || {};
  const externalIds = (media.external_ids as Record<string, unknown>) || {};

  const backdropUrl =
    (typeSpecific.backdrop_url as string | null) ||
    (typeSpecific.backdrop_path
      ? `https://image.tmdb.org/t/p/original${typeSpecific.backdrop_path}`
      : null);

  const tagline = typeSpecific.tagline as string | null;
  const runtime = typeSpecific.runtime as number | null;
  const numberOfSeasons = typeSpecific.number_of_seasons as number | null;
  const numberOfEpisodes = typeSpecific.number_of_episodes as number | null;
  const tmdbId = externalIds.tmdb_id ? String(externalIds.tmdb_id) : null;
  const imdbId = externalIds.imdb_id ? String(externalIds.imdb_id) : null;

  // Format runtime nicely
  const formattedRuntime = runtime
    ? runtime >= 60
      ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
      : `${runtime}m`
    : null;

  // Format release date nicely
  const formattedDate = media.release_date
    ? new Date(media.release_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const releaseYear = media.release_date
    ? new Date(media.release_date).getFullYear()
    : null;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleQuickLog = () => {
    setLoggedNotice(true);
    setTimeout(() => setLoggedNotice(false), 3000);
  };

  return (
    <div className="relative overflow-hidden bg-surface border-b border-border">
      {/* Atmospheric Backdrop Blur */}
      {backdropUrl && (
        <div className="absolute inset-0 z-0 opacity-15 dark:opacity-20 pointer-events-none select-none overflow-hidden">
          <Image
            src={backdropUrl}
            alt={media.title}
            fill
            priority
            sizes="100vw"
            className="object-cover blur-md scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-linear-to-b from-bg/40 via-surface/85 to-surface" />
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Catalog</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text bg-bg/80 border border-border rounded-lg transition-colors cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero Grid */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Cover Poster */}
          <div className="relative w-44 sm:w-56 md:w-64 aspect-2/3 shrink-0 rounded-xl overflow-hidden shadow-md border border-border bg-bg mx-auto md:mx-0">
            {media.cover_url ? (
              <Image
                src={media.cover_url}
                alt={media.title}
                fill
                priority
                sizes="(max-width: 768px) 224px, 256px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-text-muted bg-surface">
                <Film className="w-12 h-12 opacity-40 mb-2" />
                <span className="text-xs font-serif font-semibold">
                  {media.title}
                </span>
                <span className="text-[10px] mt-1 opacity-60">No cover art</span>
              </div>
            )}
          </div>

          {/* Title & Metadata Details */}
          <div className="flex-1 space-y-4">
            {/* Type & Year kicker (Zero-pill discipline: unboxed clean text) */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-accent">
              <span className="flex items-center gap-1 capitalize font-semibold tracking-wide">
                {media.type === "movie" ? (
                  <Film className="w-3.5 h-3.5" />
                ) : (
                  <Tv className="w-3.5 h-3.5" />
                )}
                {media.type === "movie" ? "Feature Film" : "Television Series"}
              </span>

              {releaseYear && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted">{releaseYear}</span>
                </>
              )}

              {formattedRuntime && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formattedRuntime}
                  </span>
                </>
              )}

              {numberOfSeasons !== null && numberOfSeasons !== undefined && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted">
                    {numberOfSeasons} {numberOfSeasons === 1 ? "Season" : "Seasons"}
                    {numberOfEpisodes ? ` (${numberOfEpisodes} Episodes)` : ""}
                  </span>
                </>
              )}
            </div>

            {/* Primary Headline */}
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-text tracking-tight leading-tight">
                {media.title}
              </h1>

              {tagline && (
                <p className="font-serif italic text-base sm:text-lg text-text-muted/90 mt-1.5">
                  &ldquo;{tagline}&rdquo;
                </p>
              )}
            </div>

            {/* Rating & Release Date Row */}
            <div className="flex flex-wrap items-center gap-4 py-2 border-y border-border/70 text-xs">
              {/* Community rating */}
              {media.community_rating_avg !== null && media.community_rating_avg !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-text text-sm">
                    {Number(media.community_rating_avg).toFixed(1)}
                  </span>
                  <span className="text-text-muted">/ 10</span>
                  {media.community_rating_count ? (
                    <span className="text-text-muted text-[11px]">
                      ({media.community_rating_count.toLocaleString()} votes)
                    </span>
                  ) : null}
                </div>
              )}

              {formattedDate && (
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>Released {formattedDate}</span>
                </div>
              )}
            </div>

            {/* Genres (Clean unboxed typographic layout with subtle dots) */}
            {Array.isArray(media.genres) && media.genres.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Genres
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-text">
                  {media.genres.map((genre, idx) => (
                    <React.Fragment key={genre}>
                      <span className="hover:text-accent transition-colors">
                        {genre}
                      </span>
                      {idx < media.genres.length - 1 && (
                        <span aria-hidden="true" className="text-border">·</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Synopsis */}
            {media.synopsis && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Synopsis
                </span>
                <p className="text-sm leading-relaxed text-text/90 font-sans max-w-3xl">
                  {media.synopsis}
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button
                variant="primary"
                onClick={handleQuickLog}
                className="gap-2 text-xs h-9 cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Log to Diary</span>
              </Button>

              {loggedNotice && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                  Ready to log in your journal!
                </span>
              )}

              {/* External TMDB / IMDb Links */}
              <div className="flex items-center gap-2 ml-auto text-xs">
                {tmdbId ? (
                  <a
                    href={`https://www.themoviedb.org/${media.type}/${tmdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-text-muted hover:text-accent transition-colors"
                  >
                    <span>TMDB</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
                {imdbId ? (
                  <>
                    <span aria-hidden="true" className="text-border">·</span>
                    <a
                      href={`https://www.imdb.com/title/${imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-text-muted hover:text-accent transition-colors"
                    >
                      <span>IMDb</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
