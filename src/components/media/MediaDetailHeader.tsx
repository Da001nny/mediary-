"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Star,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  BookmarkPlus,
  Edit3,
  Share2,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { LogEntryModal } from "@/components/media/LogEntryModal";
import { storedRatingToStars } from "@/lib/rating";
import type { MediaItem, MediaEntry } from "@/types/database.types";

interface MediaDetailHeaderProps {
  media: MediaItem;
}

export function MediaDetailHeader({ media }: MediaDetailHeaderProps) {
  const { user } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userEntry, setUserEntry] = useState<Partial<MediaEntry> | null>(null);

  const typeSpecific = (media.type_specific as Record<string, unknown>) || {};
  const externalIds = (media.external_ids as Record<string, unknown>) || {};
  const author =
    (typeSpecific.author as string) ||
    (Array.isArray(typeSpecific.authors) ? (typeSpecific.authors[0] as string) : null);
  const pageCount = (typeSpecific.page_count as number) || null;
  const bookSubtitle =
    (typeSpecific.subtitle as string) || (typeSpecific.series as string) || null;

  // Fetch existing user entry on mount or when user/media changes
  useEffect(() => {
    let isMounted = true;

    async function checkEntry() {
      // 1. Check local storage first for instant feedback
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("mediary_diary_entries");
          if (stored) {
            const localEntries = JSON.parse(stored);
            const found = localEntries.find(
              (e: { media_id: string }) => e.media_id === media.id
            );
            if (found && isMounted) {
              setUserEntry({
                id: found.id,
                media_id: media.id,
                status: found.status,
                rating: found.rating ?? (found.star_rating ? Math.round(found.star_rating * 20) : null),
                progress: found.progress || null,
                review: found.notes || null,
                privacy: found.privacy || "public",
              });
            }
          }
        }
      } catch {
        // Ignore local parse errors
      }

      // 2. If user is authenticated, query the server API
      if (user) {
        try {
          const res = await fetch(`/api/entries?media_id=${media.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.entry && isMounted) {
              setUserEntry(data.entry);
            }
          }
        } catch (err) {
          console.error("Failed to load user entry from server:", err);
        }
      }
    }

    checkEntry();

    return () => {
      isMounted = false;
    };
  }, [media.id, user]);

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

  const handleOpenLogModal = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsLogModalOpen(true);
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
                  <>
                    <Film className="w-3.5 h-3.5" />
                    <span>Feature Film</span>
                  </>
                ) : media.type === "tv" ? (
                  <>
                    <Tv className="w-3.5 h-3.5" />
                    <span>Television Series</span>
                  </>
                ) : media.type === "game" ? (
                  <>
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Video Game</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Book</span>
                  </>
                )}
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

              {pageCount && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {pageCount} pages
                  </span>
                </>
              )}
            </div>

            {/* Primary Headline */}
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-text tracking-tight leading-tight">
                {media.title}
              </h1>

              {author && media.type === "book" && (
                <p className="font-serif text-base sm:text-lg text-text-muted/90 mt-1">
                  by <span className="text-text font-semibold">{author}</span>
                </p>
              )}

              {tagline && (
                <p className="font-serif italic text-base sm:text-lg text-text-muted/90 mt-1.5">
                  &ldquo;{tagline}&rdquo;
                </p>
              )}

              {!tagline && bookSubtitle && media.type === "book" && (
                <p className="font-serif italic text-sm sm:text-base text-text-muted/80 mt-1">
                  {bookSubtitle}
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
                  <span className="text-text-muted">
                    / {(media.type === "game" || media.type === "book") && Number(media.community_rating_avg) <= 5 ? "5" : "10"}
                  </span>
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
              {userEntry ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge
                    variant={userEntry.status === "completed" ? "forest" : "amber"}
                    size="md"
                    dot
                    dotColor={userEntry.status === "completed" ? "forest" : "amber"}
                    className="capitalize text-xs font-semibold px-2.5 py-1"
                  >
                    {userEntry.status?.replace("_", " ")}
                  </Badge>

                  {userEntry.rating !== null && userEntry.rating !== undefined && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/15 border border-accent/30 text-accent font-bold text-xs shadow-2xs">
                      <Star className="w-3.5 h-3.5 fill-accent" />
                      <span>
                        {(storedRatingToStars(userEntry.rating) ?? 0).toFixed(1)} / 5
                      </span>
                    </div>
                  )}

                  {userEntry.progress && typeof userEntry.progress === "object" && (
                    (() => {
                      const prog = userEntry.progress as Record<string, unknown>;
                      if (media.type === "tv" && (prog.season != null || prog.episode != null)) {
                        return (
                          <Badge variant="subtle" size="md" className="font-mono text-xs">
                            {prog.season != null ? `S${prog.season}` : ""}
                            {prog.season != null && prog.episode != null ? " · " : ""}
                            {prog.episode != null ? `Ep ${prog.episode}` : ""}
                          </Badge>
                        );
                      }
                      if (media.type === "game" && (prog.hoursPlayed != null || prog.completionPct != null || prog.platform != null)) {
                        return (
                          <Badge variant="subtle" size="md" className="font-mono text-xs">
                            {prog.hoursPlayed != null ? `${prog.hoursPlayed} hrs` : ""}
                            {prog.hoursPlayed != null && prog.completionPct != null ? " · " : ""}
                            {prog.completionPct != null ? `${prog.completionPct}%` : ""}
                            {prog.platform ? ` · ${String(prog.platform)}` : ""}
                          </Badge>
                        );
                      }
                      if (media.type === "book" && prog.pagesRead != null) {
                        return (
                          <Badge variant="subtle" size="md" className="font-mono text-xs">
                            p. {String(prog.pagesRead)}{pageCount ? ` / ${pageCount}` : ""}
                          </Badge>
                        );
                      }
                      return null;
                    })()
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenLogModal}
                    className="gap-1.5 text-xs h-9 cursor-pointer"
                    leftIcon={<Edit3 className="w-3.5 h-3.5 text-accent" />}
                  >
                    <span>Edit Log</span>
                  </Button>

                  <Link
                    href="/diary"
                    className="text-xs text-text-muted hover:text-accent underline font-medium ml-1"
                  >
                    View in Diary &rarr;
                  </Link>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleOpenLogModal}
                  className="gap-2 text-xs h-9 cursor-pointer shadow-xs"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>Log to Diary</span>
                </Button>
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

      {/* Interactive Logging Modal */}
      <LogEntryModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        media={media}
        existingEntry={userEntry}
        onSaved={(entry) => setUserEntry(entry)}
        onDeleted={() => setUserEntry(null)}
      />

      {/* Auth Modal if user is not signed in */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="login"
      />
    </div>
  );
}
