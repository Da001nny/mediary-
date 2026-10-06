"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  X,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Info,
  Layers,
  ListPlus,
  Zap,
  Globe,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddToListModal } from "@/components/lists/AddToListModal";
import { SearchHitsSkeleton } from "@/components/ui/Skeleton";
import type { TMDBNormalizedSearchResult } from "@/lib/tmdb";
import type { RAWGGameSearchResult } from "@/lib/rawg";
import type { BookSearchResult } from "@/lib/google-books";
import type { MediaItem, CastMember, CrewMember } from "@/types/database.types";
import {
  searchAlgolia,
  AlgoliaMediaRecord,
} from "@/lib/algolia";

interface UnifiedSearchResult {
  id: number | string;
  type: "movie" | "tv" | "game" | "book";
  title: string;
  overview?: string | null;
  release_date?: string | null;
  year?: number | null;
  poster_url?: string | null;
  vote_average?: number;
  vote_count?: number;
  platforms?: string[];
  genres?: string[];
  author?: string | null;
  page_count?: number | null;
  isbn?: string | null;
}

interface AddToListMediaItem {
  id: string;
  title: string;
  type: string;
  cover_url?: string | null;
  release_date?: string | null;
  genres?: string[];
  synopsis?: string | null;
}

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMediaSynced?: (media: MediaItem) => void;
  initialQuery?: string;
}

export function MediaSearchModal({
  isOpen,
  onClose,
  onMediaSynced,
  initialQuery = "",
}: MediaSearchModalProps) {
  if (!isOpen) return null;

  return (
    <MediaSearchModalContent
      key={initialQuery || "default"}
      onClose={onClose}
      onMediaSynced={onMediaSynced}
      initialQuery={initialQuery}
    />
  );
}

function MediaSearchModalContent({
  onClose,
  onMediaSynced,
  initialQuery = "",
}: Omit<MediaSearchModalProps, "isOpen">) {
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<"algolia" | "external">("algolia");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv" | "game" | "book">("all");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [algoliaHits, setAlgoliaHits] = useState<AlgoliaMediaRecord[]>([]);
  const [isAlgoliaLive, setIsAlgoliaLive] = useState(false);
  const [algoliaProcessingTime, setAlgoliaProcessingTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncedMap, setSyncedMap] = useState<Record<string, MediaItem>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedItemDetails, setSelectedItemDetails] = useState<MediaItem | null>(null);
  const [addToListMedia, setAddToListMedia] = useState<AddToListMediaItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setSyncError(null);
    setSelectedItemDetails(null);
    onClose();
  }, [onClose]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      setAlgoliaHits([]);
      setIsLoading(false);
    }
  };

  // Focus input when opened
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedItemDetails) {
          setSelectedItemDetails(null);
        } else {
          handleClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemDetails, handleClose]);

  // Debounced search effect: Algolia (instant) or External (TMDB/RAWG/Books)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;

    if (searchMode === "algolia") {
      const timer = setTimeout(async () => {
        setIsLoading(true);
        try {
          const algoliaRes = await searchAlgolia(trimmed, {
            typeFilter,
            hitsPerPage: 40,
          });

          if (!cancelled) {
            setAlgoliaHits(algoliaRes.hits);
            setIsAlgoliaLive(algoliaRes.isAlgoliaLive);
            setAlgoliaProcessingTime(algoliaRes.processingTimeMS ?? null);
            setIsLoading(false);
          }
        } catch (err) {
          console.error("Algolia search failed:", err);
          if (!cancelled) setIsLoading(false);
        }
      }, 70);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      const timer = setTimeout(async () => {
        setIsLoading(true);
        try {
          const promises: Promise<Response>[] = [];

          // TMDB search (movies & tv)
          if (typeFilter === "all" || typeFilter === "movie" || typeFilter === "tv") {
            promises.push(
              fetch(
                `/api/tmdb/search?q=${encodeURIComponent(trimmed)}&type=${
                  typeFilter === "all" ? "all" : typeFilter
                }`
              ).catch(() => new Response(JSON.stringify({ results: [] })))
            );
          }

          // RAWG search (games)
          if (typeFilter === "all" || typeFilter === "game") {
            promises.push(
              fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`).catch(
                () => new Response(JSON.stringify({ results: [] }))
              )
            );
          }

          // Google Books search (books)
          if (typeFilter === "all" || typeFilter === "book") {
            promises.push(
              fetch(`/api/books/search?q=${encodeURIComponent(trimmed)}`).catch(
                () => new Response(JSON.stringify({ results: [] }))
              )
            );
          }

          const responses = await Promise.all(promises);
          const combined: UnifiedSearchResult[] = [];
          let anyMock = false;

          for (const res of responses) {
            if (res.ok) {
              const data = await res.json();
              if (data.isMock) anyMock = true;

              if (Array.isArray(data.results)) {
                for (const item of data.results) {
                  if (item.type === "game") {
                    const g = item as RAWGGameSearchResult;
                    combined.push({
                      id: g.id,
                      type: "game",
                      title: g.title,
                      overview: g.genres?.join(", ") || "Video Game",
                      release_date: g.release_date,
                      year: g.year,
                      poster_url: g.cover_url,
                      vote_average: g.rating,
                      vote_count: g.ratings_count,
                      platforms: g.platforms,
                      genres: g.genres,
                    });
                  } else if (item.type === "book") {
                    const b = item as BookSearchResult;
                    combined.push({
                      id: b.id || b.google_books_id,
                      type: "book",
                      title: b.title,
                      overview: b.subtitle || (b.author ? `By ${b.author}` : "Book"),
                      release_date: b.release_date,
                      year: b.year,
                      poster_url: b.cover_url,
                      vote_average: b.rating ?? undefined,
                      vote_count: b.ratings_count,
                      genres: b.genres,
                      author: b.author,
                      page_count: b.page_count,
                      isbn: b.isbn,
                    });
                  } else {
                    const m = item as TMDBNormalizedSearchResult;
                    combined.push({
                      id: m.id,
                      type: m.type,
                      title: m.title,
                      overview: m.overview,
                      release_date: m.release_date,
                      year: m.year,
                      poster_url: m.poster_url || m.poster_thumbnail,
                      vote_average: m.vote_average,
                      vote_count: m.vote_count,
                    });
                  }
                }
              }
            }
          }

          if (!cancelled) {
            setResults(combined);
            setIsMock(anyMock);
          }
        } catch (err) {
          console.error("Search failed:", err);
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      }, 250);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [query, typeFilter, searchMode]);

  // Trigger Sync & Upsert
  const handleSync = async (item: UnifiedSearchResult) => {
    const itemKey = `${item.type}-${item.id}`;
    setSyncingId(itemKey);
    setSyncError(null);

    try {
      let endpoint = "/api/tmdb/sync";
      let payload: Record<string, unknown> = {
        id: item.id,
        type: item.type,
      };

      if (item.type === "game") {
        endpoint = "/api/games/sync";
        payload = { id: item.id };
      } else if (item.type === "book") {
        endpoint = "/api/books/sync";
        payload = { id: String(item.id), google_books_id: String(item.id) };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to sync media item");
      }

      if (data.media) {
        setSyncedMap((prev) => ({ ...prev, [itemKey]: data.media }));
        setSelectedItemDetails(data.media);
        if (onMediaSynced) {
          onMediaSynced(data.media);
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncError(
        err instanceof Error ? err.message : "Error connecting to catalog/database"
      );
    } finally {
      setSyncingId(null);
    }
  };

  const handleOpenAddToList = (
    item: UnifiedSearchResult,
    existingMedia?: MediaItem | null
  ) => {
    const mediaObj = existingMedia || {
      id: `${item.type}-${item.id}`,
      title: item.title,
      type: item.type,
      cover_url: item.poster_url || null,
      release_date: item.release_date || (item.year ? `${item.year}-01-01` : null),
      genres: item.genres || [],
      synopsis: item.overview || null,
    };
    setAddToListMedia(mediaObj);
    // Background sync to DB if not already synced
    if (!existingMedia) {
      handleSync(item).catch(() => {});
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tmdb-search-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6 lg:p-8 sm:pt-12 lg:pt-16 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in overflow-y-auto"
    >
      <div className="w-full max-w-4xl lg:max-w-5xl bg-surface border border-border/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] card-depth animate-in zoom-in-95 duration-200 my-auto sm:my-0">
        {/* Search Header */}
        <div className="p-3 sm:p-5 lg:p-6 border-b border-border/70 bg-bg/50 space-y-2.5 sm:space-y-4">
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent text-accent-contrast flex items-center justify-center shadow-xs shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 id="tmdb-search-title" className="font-serif text-base sm:text-2xl font-bold text-text truncate">
                  Media Catalog Search
                </h2>
                <p className="hidden sm:block text-xs text-text-muted mt-0.5 truncate">
                  Instant typo-tolerant Algolia search & live external discovery across movies, TV, games, and books
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 sm:p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover/80 transition-colors cursor-pointer shrink-0"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 sm:left-4 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search movies, TV shows, games, books..."
              className="w-full h-10 sm:h-12 pl-9 sm:pl-10 pr-10 sm:pr-24 bg-surface text-text text-xs sm:text-base rounded-xl border border-border focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all placeholder:text-text-muted/60 shadow-2xs"
            />
            {isLoading ? (
              <div className="absolute right-3 sm:right-4 flex items-center text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
              </div>
            ) : query ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="absolute right-3 sm:right-4 p-1 text-text-muted hover:text-text rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Mode Switcher: Algolia Catalog (Instant) vs External Discover */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 bg-bg p-0.5 rounded-lg border border-border w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSearchMode("algolia")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  searchMode === "algolia"
                    ? "bg-accent text-accent-contrast shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Algolia Catalog</span>
                <span className="hidden md:inline text-[10px] opacity-80 font-mono">(Instant)</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchMode("external")}
                className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  searchMode === "external"
                    ? "bg-accent text-accent-contrast shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Discover External</span>
                <span className="hidden md:inline text-[10px] opacity-80 font-mono">(TMDB/RAWG/Books)</span>
              </button>
            </div>

            {searchMode === "algolia" && isAlgoliaLive && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 self-end sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Typo-Tolerant</span>
                {algoliaProcessingTime !== null && (
                  <span className="text-text-muted text-[10px]">({algoliaProcessingTime}ms)</span>
                )}
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-0.5 text-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              <span className="text-text-muted text-[10px] sm:text-[11px] uppercase tracking-wider font-mono mr-0.5 shrink-0">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-sans text-xs transition-colors cursor-pointer shrink-0 ${
                  typeFilter === "all"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("movie")}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  typeFilter === "movie"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                <Film className="w-3 h-3" /> Movies
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("tv")}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  typeFilter === "tv"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                <Tv className="w-3 h-3" /> TV
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("game")}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  typeFilter === "game"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                <Gamepad2 className="w-3 h-3" /> Games
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("book")}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  typeFilter === "book"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                <BookOpen className="w-3 h-3" /> Books
              </button>
            </div>

            {isMock && (
              <Badge variant="amber" size="sm" className="hidden sm:inline-flex text-[10px]">
                Preview Data (API Key Pending)
              </Badge>
            )}
          </div>
        </div>

        {/* Sync Error Notice */}
        {syncError && (
          <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <span>{syncError}</span>
            <button
              onClick={() => setSyncError(null)}
              className="underline text-[11px] ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results List / Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7 space-y-3 sm:space-y-4">
          {query.trim() === "" ? (
            <div className="text-center py-12 sm:py-16 px-4 space-y-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent/15 border border-accent/25 text-accent mx-auto flex items-center justify-center shadow-2xs">
                {searchMode === "algolia" ? (
                  <Zap className="w-6 h-6 sm:w-7 sm:h-7" />
                ) : (
                  <Globe className="w-6 h-6 sm:w-7 sm:h-7" />
                )}
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <p className="font-serif text-text font-bold text-base sm:text-xl">
                  {searchMode === "algolia"
                    ? "Instant Typo-Tolerant Catalog Search"
                    : "Discover Movies, TV Shows, Games & Books"}
                </p>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  {searchMode === "algolia"
                    ? "Search your synchronized media catalog with instant typo-tolerance, fast ranking, and direct access."
                    : "Search live TMDB, RAWG, and Google Books metadata with cover art, release details, platforms, developers, and authors."}
                </p>
              </div>
            </div>
          ) : searchMode === "algolia" ? (
            /* Algolia Search Mode */
            isLoading && algoliaHits.length === 0 ? (
              <div className="py-2">
                <SearchHitsSkeleton count={6} />
              </div>
            ) : algoliaHits.length === 0 ? (
              <div className="text-center py-12 sm:py-16 space-y-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted mx-auto flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-text font-serif">
                    No catalog matches found in Algolia for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    This title might not be in your local catalog yet. Search external databases to fetch full metadata and index it into Algolia.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setSearchMode("external")}
                  leftIcon={<Globe className="w-4 h-4" />}
                  className="mx-auto text-xs font-semibold"
                >
                  Discover & Index from TMDB / RAWG / Books
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
                {algoliaHits.map((hit) => {
                  return (
                    <div
                      key={hit.id}
                      className="p-3 sm:p-4.5 rounded-2xl card-depth card-depth-hover border border-border/80 bg-surface/90 transition-all group flex flex-col justify-between"
                    >
                      <div className="flex gap-2.5 sm:gap-4 items-start">
                        {/* Poster Thumbnail with Physical Object Drop Shadow */}
                        <div className="relative w-14 sm:w-20 md:w-24 aspect-2/3 rounded-xl overflow-hidden bg-bg shrink-0 poster-depth ring-1 ring-black/10 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300">
                          {hit.cover_url ? (
                            <Image
                              src={hit.cover_url}
                              alt={hit.title}
                              fill
                              sizes="(max-width: 640px) 56px, 96px"
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-surface text-text-muted">
                              {hit.type === "movie" ? (
                                <Film className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              ) : hit.type === "tv" ? (
                                <Tv className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              ) : hit.type === "book" ? (
                                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              ) : (
                                <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              )}
                              <span className="text-[9px] sm:text-[10px] font-mono leading-tight line-clamp-2">
                                No cover
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content Info */}
                        <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <h3
                              className="font-serif text-sm sm:text-base md:text-lg font-bold text-text truncate group-hover:text-accent transition-colors"
                              dangerouslySetInnerHTML={{
                                __html: hit._highlightResult?.title?.value || hit.title,
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                              <Sparkles className="w-2.5 h-2.5" />
                              Indexed
                            </span>
                            <Badge
                              variant={
                                hit.type === "movie"
                                  ? "amber"
                                  : hit.type === "tv"
                                  ? "forest"
                                  : "subtle"
                              }
                              size="sm"
                              className="capitalize text-[9px] sm:text-[10px]"
                            >
                              {hit.type}
                            </Badge>
                            {hit.year && (
                              <span className="text-xs font-mono text-text-muted">
                                {hit.year}
                              </span>
                            )}
                          </div>

                          {hit.community_rating_avg !== undefined &&
                            hit.community_rating_avg !== null &&
                            hit.community_rating_avg > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span>{(hit.community_rating_avg / 10).toFixed(1)}</span>
                                {hit.community_rating_count ? (
                                  <span className="text-[10px] text-text-muted">
                                    ({hit.community_rating_count.toLocaleString()})
                                  </span>
                                ) : null}
                              </div>
                            )}

                          {hit.author && (
                            <div className="text-xs text-text-muted truncate">
                              Author: <span className="font-semibold text-text">{hit.author}</span>
                            </div>
                          )}
                          {hit.director && (
                            <div className="text-xs text-text-muted truncate">
                              Dir: <span className="font-semibold text-text">{hit.director}</span>
                            </div>
                          )}

                          {hit.synopsis && (
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed pt-0.5">
                              {hit.synopsis}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-t border-border/70 mt-2.5 sm:mt-3">
                        <span className="text-[10px] font-mono text-text-muted flex items-center gap-1 truncate max-w-[110px]">
                          <Zap className="w-3 h-3 text-accent shrink-0" />
                          <span className="truncate">Algolia Instant</span>
                        </span>

                        <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 ml-auto flex-wrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setAddToListMedia({
                                id: hit.id,
                                title: hit.title,
                                type: hit.type,
                                cover_url: hit.cover_url || null,
                                release_date: hit.release_date || (hit.year ? `${hit.year}-01-01` : null),
                                genres: hit.genres || [],
                                synopsis: hit.synopsis || null,
                              })
                            }
                            className="text-xs h-7 sm:h-8 px-2 sm:px-3 gap-1 font-semibold cursor-pointer"
                            title="Add to custom list"
                          >
                            <ListPlus className="w-3.5 h-3.5 text-accent" />
                            <span>Add</span>
                          </Button>

                          <Link
                            href={`/media/${hit.id}`}
                            onClick={handleClose}
                            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-accent hover:text-accent-contrast hover:bg-accent bg-accent/15 border border-accent/30 rounded-lg transition-all"
                          >
                            <span>View</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* External Provider Search Mode */
            isLoading && results.length === 0 ? (
              <div className="py-2">
                <SearchHitsSkeleton count={6} />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 sm:py-16 space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted mx-auto flex items-center justify-center">
                  <Search className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-text font-serif">No external results found for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Try searching for a different keyword or checking your spelling across movies, TV, games, and books.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
                {results.map((item) => {
                  const itemKey = `${item.type}-${item.id}`;
                  const isSyncing = syncingId === itemKey;
                  const syncedItem = syncedMap[itemKey];

                  return (
                    <div
                      key={itemKey}
                      className="p-3 sm:p-4.5 rounded-2xl card-depth card-depth-hover border border-border/80 bg-surface/90 transition-all group flex flex-col justify-between"
                    >
                      <div className="flex gap-2.5 sm:gap-4 items-start">
                        {/* Poster Thumbnail with Physical Object Drop Shadow */}
                        <div className="relative w-14 sm:w-20 md:w-24 aspect-2/3 rounded-xl overflow-hidden bg-bg shrink-0 poster-depth ring-1 ring-black/10 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300">
                          {item.poster_url ? (
                            <Image
                              src={item.poster_url}
                              alt={item.title}
                              fill
                              sizes="(max-width: 640px) 56px, 96px"
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-surface text-text-muted">
                              {item.type === "movie" ? (
                                <Film className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              ) : item.type === "tv" ? (
                                <Tv className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              ) : item.type === "book" ? (
                                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              ) : (
                                <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 mb-1 opacity-50 text-accent" />
                              )}
                              <span className="text-[9px] sm:text-[10px] font-mono leading-tight line-clamp-2">
                                No cover
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content Info */}
                        <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <h3 className="font-serif text-sm sm:text-base md:text-lg font-bold text-text truncate group-hover:text-accent transition-colors">
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                            <Badge
                              variant={
                                item.type === "movie"
                                  ? "amber"
                                  : item.type === "tv"
                                  ? "forest"
                                  : "subtle"
                              }
                              size="sm"
                              className="capitalize text-[9px] sm:text-[10px]"
                            >
                              {item.type}
                            </Badge>
                            {item.year && (
                              <span className="text-xs font-mono text-text-muted">
                                {item.year}
                              </span>
                            )}
                          </div>

                          {item.vote_average !== undefined && item.vote_average > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              <span>{item.vote_average.toFixed(1)}</span>
                              {item.vote_count ? (
                                <span className="text-[10px] text-text-muted">
                                  ({item.vote_count.toLocaleString()})
                                </span>
                              ) : null}
                            </div>
                          )}

                          {item.type === "book" && item.author && (
                            <div className="text-xs text-text-muted truncate">
                              Author: <span className="font-semibold text-text">{item.author}</span>
                            </div>
                          )}

                          {item.overview && (
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed pt-0.5">
                              {item.overview}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-t border-border/70 mt-2.5 sm:mt-3">
                        <span className="text-[10px] font-mono text-text-muted truncate max-w-[90px] sm:max-w-none">
                          {item.type.toUpperCase()} #{item.id}
                        </span>

                        <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 ml-auto flex-wrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenAddToList(item, syncedItem)}
                            className="text-xs h-7 sm:h-8 px-2 sm:px-3 gap-1 font-semibold cursor-pointer"
                            title="Add to custom list"
                          >
                            <ListPlus className="w-3.5 h-3.5 text-accent" />
                            <span>Add</span>
                          </Button>

                          {syncedItem ? (
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              <Link
                                href={`/media/${syncedItem.id}`}
                                onClick={onClose}
                                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-accent hover:text-accent-contrast hover:bg-accent bg-accent/15 border border-accent/30 rounded-lg transition-all"
                              >
                                <span>View</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedItemDetails(syncedItem)}
                                className="text-xs h-7 sm:h-8 px-2 sm:px-2.5 gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">Details</span>
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isSyncing}
                              onClick={() => handleSync(item)}
                              className="text-xs h-7 sm:h-8 px-2.5 sm:px-3 gap-1 font-semibold shadow-xs"
                            >
                              {isSyncing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Syncing...</span>
                                </>
                              ) : (
                                <>
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>Sync to DB</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Selected Item Detail Drawer */}
        {selectedItemDetails && (
          <div className="p-3.5 sm:p-4 border-t border-border bg-bg space-y-3 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Upserted into `media` table
                </span>
                <h4 className="font-serif text-sm sm:text-base font-bold text-text">
                  {selectedItemDetails.title}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleOpenAddToList(
                      {
                        id: selectedItemDetails.id,
                        title: selectedItemDetails.title,
                        type: selectedItemDetails.type,
                        poster_url: selectedItemDetails.cover_url,
                      },
                      selectedItemDetails
                    )
                  }
                  className="text-xs h-7 gap-1"
                >
                  <ListPlus className="w-3.5 h-3.5 text-accent" />
                  <span>Add to List</span>
                </Button>

                <Link
                  href={`/media/${selectedItemDetails.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent/90 transition-colors shadow-xs h-7"
                >
                  <span>Go to Media Page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setSelectedItemDetails(null)}
                  className="text-xs text-text-muted hover:text-text underline ml-1 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(() => {
                const typeSpecific =
                  (selectedItemDetails.type_specific as Record<string, unknown>) || {};
                const externalIds =
                  (selectedItemDetails.external_ids as Record<string, unknown>) || {};

                if (selectedItemDetails.type === "book") {
                  const author =
                    typeSpecific.author ||
                    (Array.isArray(typeSpecific.authors) && typeSpecific.authors[0]) ||
                    "—";
                  const pageCount = typeSpecific.page_count || "—";
                  const isbn =
                    typeSpecific.isbn ||
                    typeSpecific.isbn_13 ||
                    typeSpecific.isbn_10 ||
                    "—";
                  const publisher = typeSpecific.publisher || "—";
                  const series = typeSpecific.series || "—";
                  const gbId = externalIds.google_books_id
                    ? String(externalIds.google_books_id)
                    : "—";

                  return (
                    <>
                      <div className="space-y-1.5 bg-surface p-2.5 rounded-md border border-border">
                        <span className="font-medium text-text flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-accent" /> Book Details
                        </span>
                        <p className="text-[11px] text-text-muted">
                          <strong>Type:</strong> Book | <strong>GB ID:</strong> {gbId}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          <strong>Author:</strong> {String(author)}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          <strong>Pages:</strong> {String(pageCount)}
                        </p>
                      </div>

                      <div className="space-y-1.5 bg-surface p-2.5 rounded-md border border-border">
                        <span className="font-medium text-text">Edition & Publisher</span>
                        <p className="text-[11px] text-text-muted">
                          <strong>ISBN:</strong> {String(isbn)}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          <strong>Publisher:</strong> {String(publisher)}
                        </p>
                        {series !== "—" && (
                          <p className="text-[11px] text-text-muted">
                            <strong>Series:</strong> {String(series)}
                          </p>
                        )}
                        {selectedItemDetails.last_synced_at && (
                          <p className="text-[10px] font-mono text-text-muted pt-1">
                            <strong>last_synced_at:</strong>{" "}
                            {new Date(selectedItemDetails.last_synced_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </>
                  );
                }

                if (selectedItemDetails.type === "game") {
                  const platforms = (Array.isArray(typeSpecific.platforms)
                    ? typeSpecific.platforms
                    : []) as string[];
                  const dev =
                    (Array.isArray(typeSpecific.developers) && typeSpecific.developers[0]) ||
                    typeSpecific.developer ||
                    "—";
                  const pub =
                    (Array.isArray(typeSpecific.publishers) && typeSpecific.publishers[0]) ||
                    typeSpecific.publisher ||
                    "—";
                  const rawgId = externalIds.rawg_id ? String(externalIds.rawg_id) : "—";
                  const metacritic = typeSpecific.metacritic;

                  return (
                    <>
                      <div className="space-y-1.5 bg-surface p-2.5 rounded-md border border-border">
                        <span className="font-medium text-text flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-accent" /> Game Specs
                        </span>
                        <p className="text-[11px] text-text-muted">
                          <strong>Type:</strong> Video Game | <strong>RAWG ID:</strong> {rawgId}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          <strong>Developer:</strong> {String(dev)}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          <strong>Publisher:</strong> {String(pub)}
                        </p>
                        {typeof metacritic === "number" && (
                          <p className="text-[11px] text-text-muted">
                            <strong>Metacritic:</strong> {String(metacritic)}/100
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5 bg-surface p-2.5 rounded-md border border-border">
                        <span className="font-medium text-text">Platforms ({platforms.length})</span>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {platforms.slice(0, 6).map((p) => (
                            <span
                              key={p}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                        {selectedItemDetails.last_synced_at && (
                          <p className="text-[10px] font-mono text-text-muted pt-1">
                            <strong>last_synced_at:</strong>{" "}
                            {new Date(selectedItemDetails.last_synced_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </>
                  );
                }

                const castList = (Array.isArray(typeSpecific.cast)
                  ? typeSpecific.cast
                  : []) as CastMember[];
                const crewList = (Array.isArray(typeSpecific.crew)
                  ? typeSpecific.crew
                  : []) as CrewMember[];
                const runtime =
                  (typeSpecific.runtime as number | undefined) || undefined;
                const tmdbId =
                  externalIds.tmdb_id !== undefined ? String(externalIds.tmdb_id) : "—";

                return (
                  <>
                    <div className="space-y-1.5 bg-surface p-2.5 rounded-md border border-border">
                      <span className="font-medium text-text flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-accent" /> Key Metadata
                      </span>
                      <p className="text-[11px] text-text-muted">
                        <strong>Type:</strong> {selectedItemDetails.type} |{" "}
                        <strong>TMDB ID:</strong> {tmdbId}
                      </p>
                      {runtime && (
                        <p className="text-[11px] text-text-muted">
                          <strong>Runtime:</strong> {runtime} min
                        </p>
                      )}
                      {selectedItemDetails.last_synced_at && (
                        <p className="text-[10px] font-mono text-text-muted">
                          <strong>last_synced_at:</strong>{" "}
                          {new Date(selectedItemDetails.last_synced_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Cast & Crew Snippet */}
                    <div className="space-y-1.5 bg-surface p-2.5 rounded-md border border-border">
                      <span className="font-medium text-text">Cast & Credits</span>
                      {castList.length > 0 ? (
                        <p className="text-[11px] text-text-muted line-clamp-2">
                          {castList
                            .slice(0, 4)
                            .map((c) => c.name)
                            .join(", ")}
                        </p>
                      ) : (
                        <p className="text-[11px] text-text-muted">Credits recorded in JSONB.</p>
                      )}
                      {crewList.length > 0 && (
                        <p className="text-[10px] text-text-muted line-clamp-1">
                          Crew:{" "}
                          {crewList
                            .slice(0, 3)
                            .map((cr) => `${cr.name}${cr.job ? ` (${cr.job})` : ""}`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-bg/80 border-t border-border flex items-center justify-between text-[11px] text-text-muted px-4">
          <span>meDiary Media Sync · TMDB v3 & v4</span>
          <span className="font-mono">Press Esc to exit</span>
        </div>
      </div>

      {/* Add to Custom List Modal */}
      {addToListMedia && (
        <AddToListModal
          isOpen={Boolean(addToListMedia)}
          onClose={() => setAddToListMedia(null)}
          media={addToListMedia}
        />
      )}
    </div>
  );
}
