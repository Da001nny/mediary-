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
  EyeOff,
  ListPlus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { LogEntryModal } from "@/components/media/LogEntryModal";
import { AddToListModal } from "@/components/lists/AddToListModal";
import { SpoilerReviewText } from "@/components/media/SpoilerReviewText";
import type { MediaItem, MediaEntry } from "@/types/database.types";

interface MediaDetailHeaderProps {
  media: MediaItem;
}

export function MediaDetailHeader({ media }: MediaDetailHeaderProps) {
  const { user } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
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
                review: found.review || found.notes || null,
                contains_spoilers: Boolean(found.contains_spoilers || found.progress?.contains_spoilers),
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

      <div className="relative z-10 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-14 pb-10 sm:pb-20">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between pb-6 sm:pb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-text-muted hover:text-accent transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform duration-200" />
            <span>Back to Catalog</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              type="button"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-medium text-text-muted hover:text-text bg-bg/90 hover:bg-bg border border-border rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-98"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Title</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero Grid with Desktop Proportions & Generous Breathing Room */}
        <div className="flex flex-col md:flex-row gap-8 lg:gap-14 xl:gap-16 items-start">
          {/* Cover Poster with Physical Object Drop Shadow & Hover Lift */}
          <div className="relative w-56 sm:w-64 md:w-72 lg:w-80 xl:w-96 aspect-2/3 shrink-0 rounded-2xl overflow-hidden poster-depth ring-1 ring-black/10 dark:ring-white/10 bg-bg mx-auto md:mx-0 group cursor-pointer">
            {media.cover_url ? (
              <Image
                src={media.cover_url}
                alt={media.title}
                fill
                priority
                sizes="(max-width: 768px) 256px, (max-width: 1024px) 320px, 384px"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-104"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-text-muted bg-surface">
                <Film className="w-16 h-16 opacity-30 mb-3" />
                <span className="text-base font-serif font-bold text-text">
                  {media.title}
                </span>
                <span className="text-xs mt-1 text-text-muted">No cover art</span>
              </div>
            )}
          </div>

          {/* Title & Metadata Details with Distinct Typographic Hierarchy */}
          <div className="flex-1 space-y-6 w-full min-w-0">
            {/* Type & Year kicker (Zero-pill discipline: unboxed clean text) */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-accent">
              <span className="flex items-center gap-1.5 capitalize font-semibold tracking-wide">
                {media.type === "movie" ? (
                  <>
                    <Film className="w-4 h-4" />
                    <span>Feature Film</span>
                  </>
                ) : media.type === "tv" ? (
                  <>
                    <Tv className="w-4 h-4" />
                    <span>Television Series</span>
                  </>
                ) : media.type === "game" ? (
                  <>
                    <Gamepad2 className="w-4 h-4" />
                    <span>Video Game</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span>Book</span>
                  </>
                )}
              </span>

              {releaseYear && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted font-mono">{releaseYear}</span>
                </>
              )}

              {formattedRuntime && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formattedRuntime}
                  </span>
                </>
              )}

              {numberOfSeasons !== null && numberOfSeasons !== undefined && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted font-mono">
                    {numberOfSeasons} {numberOfSeasons === 1 ? "Season" : "Seasons"}
                    {numberOfEpisodes ? ` (${numberOfEpisodes} Episodes)` : ""}
                  </span>
                </>
              )}

              {pageCount && (
                <>
                  <span aria-hidden="true" className="text-border">·</span>
                  <span className="text-text-muted flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> {pageCount} pages
                  </span>
                </>
              )}
            </div>

            {/* Primary Headline with Noticeable Typography Hierarchy */}
            <div className="space-y-2">
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black text-text tracking-tight leading-[1.08] text-balance">
                {media.title}
              </h1>

              {author && media.type === "book" && (
                <p className="font-serif text-xl sm:text-2xl text-text-muted/90 pt-1">
                  by <span className="text-text font-bold">{author}</span>
                </p>
              )}

              {tagline && (
                <p className="font-serif italic text-lg sm:text-2xl text-text-muted/90 pt-2 leading-relaxed max-w-3xl">
                  &ldquo;{tagline}&rdquo;
                </p>
              )}

              {!tagline && bookSubtitle && media.type === "book" && (
                <p className="font-serif italic text-base sm:text-lg text-text-muted/80 pt-1">
                  {bookSubtitle}
                </p>
              )}
            </div>

            {/* Rating & Release Date Row with Clear Visual Weight */}
            <div className="flex flex-wrap items-center gap-6 py-4 border-y border-border text-xs">
              {/* Community rating */}
              {media.community_rating_avg !== null && media.community_rating_avg !== undefined && (
                <div className="flex items-center gap-2.5">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span className="font-black text-text text-lg">
                    {Number(media.community_rating_avg).toFixed(1)}
                  </span>
                  <span className="text-text-muted text-xs">
                    / {(media.type === "game" || media.type === "book") && Number(media.community_rating_avg) <= 5 ? "5" : "10"}
                  </span>
                  {media.community_rating_count ? (
                    <span className="text-text-muted text-[11px] font-mono">
                      ({media.community_rating_count.toLocaleString()} community ratings)
                    </span>
                  ) : null}
                </div>
              )}

              {formattedDate && (
                <div className="flex items-center gap-2 text-text-muted">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span>Released {formattedDate}</span>
                </div>
              )}
            </div>

            {/* Genres (Clean unboxed typographic layout with subtle dots) */}
            {Array.isArray(media.genres) && media.genres.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                  Genres & Categories
                </span>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
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
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                  Synopsis & Overview
                </span>
                <p className="text-sm sm:text-base leading-relaxed text-text/90 font-sans max-w-3xl">
                  {media.synopsis}
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3.5 pt-4">
              {userEntry ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    variant={userEntry.status === "completed" ? "forest" : "amber"}
                    size="md"
                    dot
                    dotColor={userEntry.status === "completed" ? "forest" : "amber"}
                    className="capitalize text-xs font-semibold px-3 py-1"
                  >
                    {userEntry.status?.replace("_", " ")}
                  </Badge>

                  {userEntry.rating !== null && userEntry.rating !== undefined && (
                    <RatingBadge rating={userEntry.rating} size="md" />
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
                    size="md"
                    onClick={handleOpenLogModal}
                    leftIcon={<Edit3 className="w-4 h-4 text-accent" />}
                  >
                    Edit Log
                  </Button>

                  <Link
                    href="/diary"
                    className="text-xs text-text-muted hover:text-accent font-semibold ml-1.5 flex items-center gap-1.5 transition-colors group"
                  >
                    <span>View in Diary</span>
                    <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </Link>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleOpenLogModal}
                  leftIcon={<BookmarkPlus className="w-4 h-4" />}
                >
                  Log to Diary
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsAddToListOpen(true)}
                leftIcon={<ListPlus className="w-4 h-4 text-accent" />}
              >
                Add to List
              </Button>

              {/* User's Written Review Snippet with Card Depth */}
              {userEntry?.review && (
                <div className="w-full mt-4 sm:mt-6 p-4 sm:p-7 rounded-2xl card-depth text-xs sm:text-sm space-y-3 sm:space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-text-muted pb-3 border-b border-border">
                    <span className="font-bold text-text text-xs sm:text-sm flex items-center gap-2">
                      <span>Your Logged Notes & Reflections</span>
                    </span>
                    {userEntry.contains_spoilers && (
                      <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-medium">
                        <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Spoiler tagged</span>
                      </span>
                    )}
                  </div>
                  <div className="text-text/90 leading-relaxed">
                    <SpoilerReviewText
                      text={userEntry.review}
                      containsSpoilers={userEntry.contains_spoilers}
                      isAuthor={true}
                    />
                  </div>
                </div>
              )}

              {/* External TMDB / IMDb Links */}
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto justify-start sm:justify-end text-xs pt-1 sm:pt-0">
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

      {/* Add to Custom List Modal */}
      <AddToListModal
        isOpen={isAddToListOpen}
        onClose={() => setIsAddToListOpen(false)}
        media={media}
      />
    </div>
  );
}
