"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  Loader2,
  ChevronRight,
  ListPlus,
  Zap,
  Sparkles,
  Plus,
  AlertCircle,
  Lock,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddToListModal } from "@/components/lists/AddToListModal";
import { SearchHitsSkeleton } from "@/components/ui/Skeleton";
import type { TMDBNormalizedSearchResult } from "@/lib/tmdb";
import type { RAWGGameSearchResult } from "@/lib/rawg";
import type { BookSearchResult } from "@/lib/google-books";
import type { MediaItem } from "@/types/database.types";
import { searchAlgolia, AlgoliaMediaRecord } from "@/lib/algolia";

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
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv" | "game" | "book">("all");

  // Catalog search state (Algolia)
  const [algoliaHits, setAlgoliaHits] = useState<AlgoliaMediaRecord[]>([]);
  const [isAlgoliaLive, setIsAlgoliaLive] = useState(false);
  const [algoliaProcessingTime, setAlgoliaProcessingTime] = useState<number | null>(null);
  const [isAlgoliaLoading, setIsAlgoliaLoading] = useState(false);

  // External search state (TMDB, RAWG, Google Books)
  const [externalResults, setExternalResults] = useState<UnifiedSearchResult[]>([]);
  const [isExternalLoading, setIsExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isMock, setIsMock] = useState(false);

  // Action states
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncedMap, setSyncedMap] = useState<Record<string, MediaItem>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [addToListMedia, setAddToListMedia] = useState<AddToListMediaItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setSyncError(null);
    onClose();
  }, [onClose]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setIsUnauthorized(false);
    setIsRateLimited(false);
    if (!val.trim()) {
      setAlgoliaHits([]);
      setExternalResults([]);
      setExternalError(null);
      setIsAlgoliaLoading(false);
      setIsExternalLoading(false);
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
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // 1. Algolia catalog search (instant, fast debounce 60ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setIsAlgoliaLoading(true);
      try {
        const algoliaRes = await searchAlgolia(trimmed, {
          typeFilter,
          hitsPerPage: 40,
        });

        if (!cancelled) {
          if (algoliaRes.isRateLimited) {
            setIsRateLimited(true);
          }
          setAlgoliaHits(algoliaRes.hits);
          setIsAlgoliaLive(algoliaRes.isAlgoliaLive);
          setAlgoliaProcessingTime(algoliaRes.processingTimeMS ?? null);
          setIsAlgoliaLoading(false);
        }
      } catch (err) {
        console.error("Algolia search failed:", err);
        if (!cancelled) {
          setIsAlgoliaLoading(false);
        }
      }
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, typeFilter]);

  // 2. Parallel External Search (TMDB, RAWG, Google Books, debounced 260ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setIsExternalLoading(true);
      setExternalError(null);
      setIsUnauthorized(false);
      try {
        const fetchPromises: Promise<{ source: string; items: UnifiedSearchResult[]; isMock?: boolean; is401?: boolean; is429?: boolean }>[] = [];

        // TMDB (movies & TV)
        if (typeFilter === "all" || typeFilter === "movie" || typeFilter === "tv") {
          const tmdbPromise = fetch(
            `/api/tmdb/search?q=${encodeURIComponent(trimmed)}&type=${
              typeFilter === "all" ? "all" : typeFilter
            }`
          )
            .then(async (res) => {
              if (res.status === 401) {
                return { source: "tmdb", items: [], is401: true };
              }
              if (res.status === 429) {
                return { source: "tmdb", items: [], is429: true };
              }
              if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
              const data = await res.json();
              const items: UnifiedSearchResult[] = (data.results || []).map(
                (m: TMDBNormalizedSearchResult) => ({
                  id: m.id,
                  type: m.type,
                  title: m.title,
                  overview: m.overview,
                  release_date: m.release_date,
                  year: m.year,
                  poster_url: m.poster_url || m.poster_thumbnail,
                  vote_average: m.vote_average,
                  vote_count: m.vote_count,
                })
              );
              return { source: "tmdb", items, isMock: Boolean(data.isMock) };
            })
            .catch((err) => {
              console.warn("External TMDB search failed:", err);
              return { source: "tmdb", items: [] };
            });

          fetchPromises.push(tmdbPromise);
        }

        // RAWG (games)
        if (typeFilter === "all" || typeFilter === "game") {
          const rawgPromise = fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`)
            .then(async (res) => {
              if (res.status === 401) {
                return { source: "rawg", items: [], is401: true };
              }
              if (res.status === 429) {
                return { source: "rawg", items: [], is429: true };
              }
              if (!res.ok) throw new Error(`RAWG HTTP ${res.status}`);
              const data = await res.json();
              const items: UnifiedSearchResult[] = (data.results || []).map(
                (g: RAWGGameSearchResult) => ({
                  id: g.id,
                  type: "game" as const,
                  title: g.title,
                  overview: g.genres?.join(", ") || "Video Game",
                  release_date: g.release_date,
                  year: g.year,
                  poster_url: g.cover_url,
                  vote_average: g.rating,
                  vote_count: g.ratings_count,
                  platforms: g.platforms,
                  genres: g.genres,
                })
              );
              return { source: "rawg", items, isMock: Boolean(data.isMock) };
            })
            .catch((err) => {
              console.warn("External RAWG search failed:", err);
              return { source: "rawg", items: [] };
            });

          fetchPromises.push(rawgPromise);
        }

        // Google Books (books)
        if (typeFilter === "all" || typeFilter === "book") {
          const booksPromise = fetch(`/api/books/search?q=${encodeURIComponent(trimmed)}`)
            .then(async (res) => {
              if (res.status === 401) {
                return { source: "books", items: [], is401: true };
              }
              if (res.status === 429) {
                return { source: "books", items: [], is429: true };
              }
              if (!res.ok) throw new Error(`Google Books HTTP ${res.status}`);
              const data = await res.json();
              const items: UnifiedSearchResult[] = (data.results || []).map(
                (b: BookSearchResult) => ({
                  id: b.id || b.google_books_id,
                  type: "book" as const,
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
                })
              );
              return { source: "books", items, isMock: Boolean(data.isMock) };
            })
            .catch((err) => {
              console.warn("External Google Books search failed:", err);
              return { source: "books", items: [] };
            });

          fetchPromises.push(booksPromise);
        }

        const responses = await Promise.all(fetchPromises);
        if (cancelled) return;

        const combined: UnifiedSearchResult[] = [];
        let anyMock = false;
        let any401 = false;
        let any429 = false;
        let successfulSources = 0;

        for (const res of responses) {
          if (res.is401) any401 = true;
          if (res.is429) any429 = true;
          if (res.items.length > 0) {
            successfulSources++;
            combined.push(...res.items);
          }
          if (res.isMock) anyMock = true;
        }

        setIsUnauthorized(any401);
        if (any429) {
          setIsRateLimited(true);
        }
        setExternalResults(combined);
        setIsMock(anyMock);
        setIsExternalLoading(false);

        if (fetchPromises.length > 0 && successfulSources === 0 && combined.length === 0) {
          // If all requested sources produced 0 items, check if there was a network/API issue
          setExternalError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("External search aggregate error:", err);
          setExternalError(
            err instanceof Error ? err.message : "Failed to fetch external results"
          );
          setIsExternalLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, typeFilter]);

  // Match and hide external results that are already in the catalog (Requirement 4)
  const isAlreadyInCatalog = useCallback(
    (item: UnifiedSearchResult): boolean => {
      const itemExternalIdStr = String(item.id).trim();
      const itemKey = `${item.type}-${item.id}`;

      // Check session sync cache
      if (syncedMap[itemKey]) {
        return true;
      }

      // Check against Algolia catalog records
      for (const hit of algoliaHits) {
        if (hit.type !== item.type) continue;
        const ext = (hit.external_ids || {}) as Record<string, unknown>;

        if (item.type === "movie" || item.type === "tv") {
          if (
            String(ext.tmdb_id).trim() === itemExternalIdStr ||
            String(ext.id).trim() === itemExternalIdStr ||
            hit.id === `tmdb-${item.id}` ||
            hit.id === itemExternalIdStr
          ) {
            return true;
          }
        } else if (item.type === "game") {
          if (
            String(ext.rawg_id).trim() === itemExternalIdStr ||
            String(ext.id).trim() === itemExternalIdStr ||
            hit.id === `rawg-${item.id}` ||
            hit.id === itemExternalIdStr
          ) {
            return true;
          }
        } else if (item.type === "book") {
          if (
            String(ext.google_books_id).trim() === itemExternalIdStr ||
            String(ext.id).trim() === itemExternalIdStr ||
            (item.isbn && String(ext.isbn).trim() === String(item.isbn).trim()) ||
            hit.id === `book-${item.id}` ||
            hit.id === itemExternalIdStr
          ) {
            return true;
          }
        }

        // Exact title and release year match for the same type
        if (
          hit.title.toLowerCase().trim() === item.title.toLowerCase().trim() &&
          hit.year &&
          item.year &&
          hit.year === item.year
        ) {
          return true;
        }
      }

      return false;
    },
    [algoliaHits, syncedMap]
  );

  const filteredExternalResults = externalResults.filter(
    (item) => !isAlreadyInCatalog(item)
  );

  // "Add and open" action (Requirement 5)
  const handleAddAndOpen = async (item: UnifiedSearchResult) => {
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
        throw new Error(data.error || "Failed to sync media item into catalog");
      }

      const syncedMedia = data.media as MediaItem;
      if (syncedMedia?.id) {
        setSyncedMap((prev) => ({ ...prev, [itemKey]: syncedMedia }));
        if (onMediaSynced) {
          onMediaSynced(syncedMedia);
        }
        // Close modal and navigate immediately to the title page
        onClose();
        router.push(`/media/${syncedMedia.id}`);
      } else {
        throw new Error("Missing media record from sync response");
      }
    } catch (err) {
      console.error("Add and open failed:", err);
      setSyncError(
        err instanceof Error ? err.message : "Error connecting to catalog/database"
      );
      setSyncingId(null);
    }
  };

  const hasCatalogHits = algoliaHits.length > 0;
  const isInputActive = query.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-search-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-5 lg:p-7 sm:pt-10 lg:pt-14 bg-black/65 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in overflow-y-auto"
    >
      <div className="w-full max-w-4xl lg:max-w-5xl bg-surface border border-border/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] card-depth animate-in zoom-in-95 duration-150 my-auto sm:my-0">
        {/* Header: Single Search Input and Filter Bar */}
        <div className="p-3 sm:p-5 lg:p-6 border-b border-border/70 bg-bg/50 space-y-3">
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent text-accent-contrast flex items-center justify-center shadow-xs shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2
                  id="media-search-title"
                  className="font-serif text-base sm:text-2xl font-bold text-text truncate"
                >
                  Search Media
                </h2>
                <p className="hidden sm:block text-xs text-text-muted mt-0.5 truncate">
                  Instant catalog results and live external discovery across movies, TV, games, and books
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 sm:p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover/80 transition-colors cursor-pointer shrink-0"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Single Search Input Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 sm:left-4 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search movies, TV shows, games, books..."
              className="w-full h-10 sm:h-12 pl-9 sm:pl-11 pr-10 sm:pr-24 bg-surface text-text text-xs sm:text-base rounded-xl border border-border focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all placeholder:text-text-muted/60 shadow-2xs"
            />
            {isAlgoliaLoading || isExternalLoading ? (
              <div className="absolute right-3 sm:right-4 flex items-center text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
              </div>
            ) : query ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="absolute right-3 sm:right-4 p-1 text-text-muted hover:text-text rounded cursor-pointer"
                aria-label="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Type Filter Tabs (All / Movies / TV / Games / Books) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-0.5 text-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pb-0.5 max-w-full">
              <span className="text-text-muted text-[10px] sm:text-[11px] uppercase tracking-wider font-mono mr-0.5 shrink-0 hidden xs:inline">
                Type:
              </span>
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-sans text-xs font-semibold tracking-[-0.005em] transition-all cursor-pointer shrink-0 ${
                  typeFilter === "all"
                    ? "bg-accent text-accent-contrast shadow-2xs"
                    : "bg-surface text-text-muted hover:text-text border border-border hover:bg-surface-hover"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("movie")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-sans text-xs font-semibold tracking-[-0.005em] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  typeFilter === "movie"
                    ? "bg-accent text-accent-contrast shadow-2xs"
                    : "bg-surface text-text-muted hover:text-text border border-border hover:bg-surface-hover"
                }`}
              >
                <Film className="w-3.5 h-3.5 shrink-0" />
                <span>Movies</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("tv")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-sans text-xs font-semibold tracking-[-0.005em] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  typeFilter === "tv"
                    ? "bg-accent text-accent-contrast shadow-2xs"
                    : "bg-surface text-text-muted hover:text-text border border-border hover:bg-surface-hover"
                }`}
              >
                <Tv className="w-3.5 h-3.5 shrink-0" />
                <span>TV</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("game")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-sans text-xs font-semibold tracking-[-0.005em] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  typeFilter === "game"
                    ? "bg-accent text-accent-contrast shadow-2xs"
                    : "bg-surface text-text-muted hover:text-text border border-border hover:bg-surface-hover"
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                <span>Games</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("book")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-sans text-xs font-semibold tracking-[-0.005em] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  typeFilter === "book"
                    ? "bg-accent text-accent-contrast shadow-2xs"
                    : "bg-surface text-text-muted hover:text-text border border-border hover:bg-surface-hover"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Books</span>
              </button>
            </div>

            {isMock && (
              <Badge variant="amber" size="sm" className="hidden sm:inline-flex text-[10px]">
                Preview Data (API Keys Pending)
              </Badge>
            )}
          </div>
        </div>

        {/* Sync or Network Error Notice */}
        {syncError && (
          <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="underline text-[11px] ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7 space-y-6">
          {!isInputActive ? (
            /* Welcome / Empty state */
            <div className="text-center py-12 sm:py-16 px-4 space-y-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent/15 border border-accent/25 text-accent mx-auto flex items-center justify-center shadow-2xs">
                <Search className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <p className="font-serif text-text font-bold text-base sm:text-xl">
                  Unified Media Search
                </p>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Start typing to instantly search your synchronized catalog with typo tolerance, and discover new titles from TMDB, RAWG, and Google Books.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 1: Catalog Results (Algolia Hits) */}
              {hasCatalogHits && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-sm sm:text-base font-bold text-text">
                        In Your Catalog
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-accent/15 text-accent font-semibold">
                        {algoliaHits.length}
                      </span>
                    </div>

                    {isAlgoliaLive && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="hidden sm:inline">Instant</span>
                        {algoliaProcessingTime !== null && (
                          <span className="text-text-muted text-[10px]">
                            ({algoliaProcessingTime}ms)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {algoliaHits.map((hit) => (
                      <div
                        key={hit.id}
                        className="p-3 sm:p-4 rounded-2xl card-depth card-depth-hover border border-border/80 bg-surface/90 transition-all group flex flex-col justify-between"
                      >
                        <div className="flex gap-2.5 sm:gap-3.5 items-start">
                          {/* Poster Thumbnail */}
                          <div className="relative w-14 sm:w-20 md:w-24 aspect-2/3 rounded-xl overflow-hidden bg-bg shrink-0 poster-depth ring-1 ring-black/10 dark:ring-white/10 group-hover:scale-105 transition-transform duration-200">
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
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4
                              className="font-serif text-sm sm:text-base font-bold text-text truncate group-hover:text-accent transition-colors"
                              dangerouslySetInnerHTML={{
                                __html: hit._highlightResult?.title?.value || hit.title,
                              }}
                            />

                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                <Sparkles className="w-2.5 h-2.5" />
                                Catalog
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
                            {hit.developer && (
                              <div className="text-xs text-text-muted truncate">
                                Dev: <span className="font-semibold text-text">{hit.developer}</span>
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
                        <div className="pt-2 sm:pt-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 border-t border-border/70 mt-2.5">
                          <span className="text-[10px] font-mono text-text-muted flex items-center gap-1 truncate">
                            <Zap className="w-3 h-3 text-accent shrink-0" />
                            <span>Indexed</span>
                          </span>

                          <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 ml-auto">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setAddToListMedia({
                                  id: hit.id,
                                  title: hit.title,
                                  type: hit.type,
                                  cover_url: hit.cover_url || null,
                                  release_date:
                                    hit.release_date || (hit.year ? `${hit.year}-01-01` : null),
                                  genres: hit.genres || [],
                                  synopsis: hit.synopsis || null,
                                })
                              }
                              className="text-xs h-8 px-2.5 sm:px-3 gap-1.5 font-semibold cursor-pointer"
                              title="Add to custom list"
                            >
                              <ListPlus className="w-3.5 h-3.5 text-accent" />
                              <span>Add</span>
                            </Button>

                            <Link
                              href={`/media/${hit.id}`}
                              onClick={handleClose}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-text hover:text-[#0E0902] dark:hover:text-[#0A0702] bg-surface hover:bg-accent border border-border hover:border-amber-950/20 rounded-lg transition-all shadow-2xs hover:shadow-xs h-8"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION 2: External Discovery Results (Requirement 2 & 6) */}
              <section className={`space-y-3 ${hasCatalogHits ? "pt-5 border-t border-border/80" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-sm sm:text-base font-bold text-text">
                      Not in your catalog yet
                    </h3>
                    {!isExternalLoading && filteredExternalResults.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface border border-border text-text-muted">
                        {filteredExternalResults.length}
                      </span>
                    )}
                  </div>

                  {isExternalLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      <span className="text-[11px] font-mono hidden xs:inline">
                        Searching external databases...
                      </span>
                    </div>
                  )}
                </div>

                {/* Inline message if external fetch encountered an error */}
                {externalError && !isUnauthorized && !isRateLimited && (
                  <div className="text-xs text-red-500/90 dark:text-red-400/90 flex items-center gap-1.5 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>External search error: {externalError}. You can retry or adjust your search term.</span>
                  </div>
                )}

                {/* Friendly rate-limit prompt when rate limit is exceeded (429) */}
                {isRateLimited ? (
                  <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 card-depth text-center flex flex-col items-center justify-center space-y-3 my-2 animate-in fade-in duration-200">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h4 className="font-serif text-base font-bold text-text">
                        You&apos;re searching too fast, try again in a minute
                      </h4>
                      <p className="text-xs text-text-muted leading-relaxed">
                        To protect catalog stability and respect upstream quotas, requests are temporarily throttled. Please wait a moment before trying your search again.
                      </p>
                    </div>
                  </div>
                ) : isUnauthorized ? (
                  <div className="p-6 rounded-2xl border border-accent/25 bg-surface/90 card-depth text-center flex flex-col items-center justify-center space-y-3 my-2">
                    <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shadow-2xs">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h4 className="font-serif text-base font-bold text-text">
                        Sign in to search and view details
                      </h4>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Searching external live databases (TMDB, RAWG, and Google Books) requires being signed in to your meDiary account.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
                        onClick={handleClose}
                      >
                        <Button variant="primary" size="sm">
                          Sign In
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : isExternalLoading && filteredExternalResults.length === 0 ? (
                  <div className="py-1">
                    <SearchHitsSkeleton count={hasCatalogHits ? 2 : 4} />
                  </div>
                ) : filteredExternalResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {filteredExternalResults.map((item) => {
                      const itemKey = `${item.type}-${item.id}`;
                      const isSyncing = syncingId === itemKey;

                      return (
                        <div
                          key={itemKey}
                          className="p-3 sm:p-4 rounded-2xl card-depth card-depth-hover border border-border/80 bg-surface/90 transition-all group flex flex-col justify-between"
                        >
                          <div className="flex gap-2.5 sm:gap-3.5 items-start">
                            {/* Poster Thumbnail */}
                            <div className="relative w-14 sm:w-20 md:w-24 aspect-2/3 rounded-xl overflow-hidden bg-bg shrink-0 poster-depth ring-1 ring-black/10 dark:ring-white/10 group-hover:scale-105 transition-transform duration-200">
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
                            <div className="flex-1 min-w-0 space-y-1">
                              <h4 className="font-serif text-sm sm:text-base font-bold text-text truncate group-hover:text-accent transition-colors">
                                {item.title}
                              </h4>

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

                          {/* Action buttons with "Add and open" primary CTA */}
                          <div className="pt-2 sm:pt-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 border-t border-border/70 mt-2.5">
                            <span className="text-[10px] font-mono text-text-muted truncate max-w-[90px] sm:max-w-none">
                              {item.type.toUpperCase()} #{item.id}
                            </span>

                            <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 ml-auto">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setAddToListMedia({
                                    id: `${item.type}-${item.id}`,
                                    title: item.title,
                                    type: item.type,
                                    cover_url: item.poster_url || null,
                                    release_date:
                                      item.release_date || (item.year ? `${item.year}-01-01` : null),
                                    genres: item.genres || [],
                                    synopsis: item.overview || null,
                                  })
                                }
                                className="text-xs h-8 px-2 sm:px-2.5 gap-1 font-semibold cursor-pointer"
                                title="Add to custom list"
                              >
                                <ListPlus className="w-3.5 h-3.5 text-accent" />
                                <span className="hidden sm:inline">List</span>
                              </Button>

                              {/* Primary "Add and open" Action (Requirement 5) */}
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={isSyncing}
                                onClick={() => handleAddAndOpen(item)}
                                className="text-xs h-8 px-3 sm:px-3.5 gap-1.5 font-semibold shadow-xs shrink-0 cursor-pointer"
                              >
                                {isSyncing ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Syncing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Add and open</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !isExternalLoading && !hasCatalogHits && !isUnauthorized && !isRateLimited ? (
                  /* Zero hits across both Algolia and External (Requirement 6) */
                  <div className="text-center py-10 sm:py-12 px-4 space-y-3 max-w-md mx-auto">
                    <div className="w-10 h-10 rounded-xl bg-surface border border-border text-text-muted mx-auto flex items-center justify-center">
                      <Search className="w-5 h-5" />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-text font-serif">
                      No titles found for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-text-muted leading-relaxed">
                      We searched both your local catalog and live databases (TMDB, RAWG, and Google Books). Try checking your spelling or trying alternative keywords.
                    </p>
                  </div>
                ) : !isExternalLoading && hasCatalogHits && filteredExternalResults.length === 0 ? (
                  <p className="text-xs text-text-muted italic py-1">
                    All matching results for &ldquo;{query}&rdquo; are already in your catalog.
                  </p>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Add To Custom List Modal */}
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
