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
  Star,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Info,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { TMDBNormalizedSearchResult } from "@/lib/tmdb";
import type { RAWGGameSearchResult } from "@/lib/rawg";
import type { MediaItem, CastMember, CrewMember } from "@/types/database.types";

interface UnifiedSearchResult {
  id: number;
  type: "movie" | "tv" | "game";
  title: string;
  overview?: string | null;
  release_date?: string | null;
  year?: number | null;
  poster_url?: string | null;
  vote_average?: number;
  vote_count?: number;
  platforms?: string[];
  genres?: string[];
}

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMediaSynced?: (media: MediaItem) => void;
}

export function MediaSearchModal({
  isOpen,
  onClose,
  onMediaSynced,
}: MediaSearchModalProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv" | "game">("all");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncedMap, setSyncedMap] = useState<Record<string, MediaItem>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedItemDetails, setSelectedItemDetails] = useState<MediaItem | null>(null);

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
      setIsLoading(false);
    }
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        if (selectedItemDetails) {
          setSelectedItemDetails(null);
        } else {
          handleClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedItemDetails, handleClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;
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
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, typeFilter]);

  // Trigger Sync & Upsert
  const handleSync = async (item: UnifiedSearchResult) => {
    const itemKey = `${item.type}-${item.id}`;
    setSyncingId(itemKey);
    setSyncError(null);

    try {
      const endpoint = item.type === "game" ? "/api/games/sync" : "/api/tmdb/sync";
      const payload =
        item.type === "game"
          ? { id: item.id }
          : { id: item.id, type: item.type };

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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tmdb-search-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-16 bg-black/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-bg/50 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent text-accent-contrast flex items-center justify-center">
                <Search className="w-3.5 h-3.5" />
              </div>
              <h2 id="tmdb-search-title" className="font-serif text-lg font-bold text-text">
                Media Catalog Search
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-bg transition-colors cursor-pointer"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search movies, TV shows, or video games (e.g., Elden Ring, Severance)..."
              className="w-full h-11 pl-10 pr-20 bg-surface text-text text-sm rounded-lg border border-border focus:border-accent focus:ring-1 focus:ring-ring outline-none transition-all placeholder:text-text-muted/60"
            />
            {isLoading ? (
              <div className="absolute right-3.5 flex items-center text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
              </div>
            ) : query ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="absolute right-3.5 p-1 text-text-muted hover:text-text rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-text-muted text-[11px] uppercase tracking-wider font-mono mr-1">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 py-1 rounded-md font-sans text-xs transition-colors cursor-pointer ${
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
                className={`px-2.5 py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 ${
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
                className={`px-2.5 py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === "tv"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                <Tv className="w-3 h-3" /> TV Shows
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("game")}
                className={`px-2.5 py-1 rounded-md font-sans text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === "game"
                    ? "bg-accent text-accent-contrast font-medium"
                    : "bg-bg text-text-muted hover:text-text border border-border"
                }`}
              >
                <Gamepad2 className="w-3 h-3" /> Games
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

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {query.trim() === "" ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-accent/15 text-accent mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-serif text-text font-medium text-base">
                Discover Movies, TV Shows & Games
              </p>
              <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                Search live TMDB and RAWG metadata with cover art, release details,
                platforms, developers, and streaming providers.
              </p>
            </div>
          ) : isLoading && results.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-xs text-text-muted">Searching catalog...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm font-medium text-text">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-text-muted">
                Try searching for a different keyword or checking your spelling.
              </p>
            </div>
          ) : (
            results.map((item) => {
              const itemKey = `${item.type}-${item.id}`;
              const isSyncing = syncingId === itemKey;
              const syncedItem = syncedMap[itemKey];

              return (
                <div
                  key={itemKey}
                  className="flex gap-3 sm:gap-4 p-3 rounded-lg border border-border bg-bg/40 hover:bg-bg/80 transition-colors group"
                >
                  {/* Poster Thumbnail */}
                  <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-md overflow-hidden bg-surface shrink-0 border border-border shadow-2xs">
                    {item.poster_url ? (
                      <Image
                        src={item.poster_url}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-surface text-text-muted">
                        {item.type === "movie" ? (
                          <Film className="w-5 h-5 mb-1 opacity-50" />
                        ) : item.type === "tv" ? (
                          <Tv className="w-5 h-5 mb-1 opacity-50" />
                        ) : (
                          <Gamepad2 className="w-5 h-5 mb-1 opacity-50" />
                        )}
                        <span className="text-[9px] font-mono leading-tight line-clamp-2">
                          No cover
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-sm sm:text-base font-semibold text-text truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant={
                              item.type === "movie"
                                ? "amber"
                                : item.type === "tv"
                                ? "forest"
                                : "subtle"
                            }
                            size="sm"
                            className="capitalize text-[10px]"
                          >
                            {item.type}
                          </Badge>
                          {item.year && (
                            <span className="text-xs font-mono text-text-muted">
                              {item.year}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.vote_average !== undefined && item.vote_average > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{item.vote_average.toFixed(1)}</span>
                          {item.vote_count ? (
                            <span className="text-[10px] text-text-muted">
                              ({item.vote_count.toLocaleString()} votes)
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Platforms Preview for Games */}
                      {item.type === "game" && item.platforms && item.platforms.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.platforms.slice(0, 3).map((plat) => (
                            <span
                              key={plat}
                              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-text-muted"
                            >
                              {plat}
                            </span>
                          ))}
                          {item.platforms.length > 3 && (
                            <span className="text-[10px] text-text-muted">
                              +{item.platforms.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {item.overview && (
                        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                          {item.overview}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/50 mt-2">
                      <span className="text-[10px] font-mono text-text-muted">
                        {item.type === "game" ? "RAWG ID" : "TMDB ID"}: {item.id}
                      </span>

                      <div className="flex items-center gap-2">
                        {syncedItem ? (
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/media/${syncedItem.id}`}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
                            >
                              <span>View Page</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedItemDetails(syncedItem)}
                              className="text-xs h-7 gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Details</span>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isSyncing}
                            onClick={() => handleSync(item)}
                            className="text-xs h-7 gap-1.5"
                          >
                            {isSyncing ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Syncing...</span>
                              </>
                            ) : (
                              <>
                                <Layers className="w-3 h-3" />
                                <span>Sync to DB</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Item Detail Drawer */}
        {selectedItemDetails && (
          <div className="p-4 border-t border-border bg-bg space-y-3 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Upserted into `media` table
                </span>
                <h4 className="font-serif text-base font-bold text-text">
                  {selectedItemDetails.title}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/media/${selectedItemDetails.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-accent text-white text-xs font-semibold rounded-md hover:bg-accent/90 transition-colors shadow-xs"
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
    </div>
  );
}
