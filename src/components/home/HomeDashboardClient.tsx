"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Sparkles,
  BookMarked,
  Clock,
  Plus,
  Lock,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { Skeleton, PosterSkeleton } from "@/components/ui/Skeleton";
import { AuthModal } from "@/components/auth/AuthModal";
import { MediaSearchModal } from "@/components/media/MediaSearchModal";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { useAuth } from "@/context/AuthContext";
import type { MediaItem, EntryStatus } from "@/types/database.types";

interface HomeEntryItem {
  id: string;
  user_id: string;
  media_id: string;
  status: EntryStatus;
  rating: number | null;
  progress?: {
    season?: number;
    episode?: number;
    page?: number;
    totalPages?: number;
    percent?: number;
  } | null;
  review?: string | null;
  contains_spoilers?: boolean;
  privacy: string;
  created_at: string;
  updated_at?: string;
  media: MediaItem | null;
}

interface HomeDashboardClientProps {
  trendingSection: React.ReactNode;
  popularSection?: React.ReactNode;
}

export function HomeDashboardClient({
  trendingSection,
  popularSection,
}: HomeDashboardClientProps) {
  const { user, profile, isLoading: isAuthLoading } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");

  // Data states for signed-in home dashboard
  const [inProgressEntries, setInProgressEntries] = useState<HomeEntryItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<HomeEntryItem[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Time-of-day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Reader";

  // Clean up legacy localStorage diary entries on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("mediary_diary_entries");
      } catch {
        // ignore
      }
    }
  }, []);

  // Load user entries when authenticated
  useEffect(() => {
    let cancelled = false;

    if (user) {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setIsLoadingDashboard(true);
        fetch("/api/home/entries")
          .then((res) => (res.ok ? res.json() : Promise.reject(res)))
          .then((data) => {
            if (cancelled) return;
            const fetchedProg = Array.isArray(data?.inProgress) ? data.inProgress : [];
            const fetchedRecent = Array.isArray(data?.recent) ? data.recent : [];

            // Directly set user database entries without sample/demo fallbacks
            setInProgressEntries(fetchedProg);
            setRecentEntries(fetchedRecent);
          })
          .catch((err) => {
            console.warn("Could not load user home entries:", err);
            if (!cancelled) {
              setInProgressEntries([]);
              setRecentEntries([]);
            }
          })
          .finally(() => {
            if (!cancelled) setIsLoadingDashboard(false);
          });
      });
    } else {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setInProgressEntries([]);
        setRecentEntries([]);
        setIsLoadingDashboard(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const openSearch = (initialQuery = "") => {
    setSearchInitialQuery(initialQuery);
    setIsSearchModalOpen(true);
  };

  const getMediaBadgeVariant = (type?: string) => {
    switch (type) {
      case "movie":
        return "amber";
      case "tv":
        return "forest";
      case "game":
        return "subtle";
      case "book":
        return "forest";
      default:
        return "subtle";
    }
  };

  const getStatusLabel = (status: EntryStatus) => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "planned":
        return "Planned";
      case "dropped":
        return "Dropped";
      case "on_hold":
        return "On Hold";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-accent/25 selection:text-text">
      {/* Top Navigation */}
      <TopNav />

      <main className="flex-1 max-w-6xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8 sm:space-y-14">
        {/* ============================================================== */}
        {/* SIGNED-OUT VIEW                                                */}
        {/* ============================================================== */}
        {!user && !isAuthLoading && (
          <div className="space-y-10 sm:space-y-16 animate-in fade-in duration-300">
            {/* Landing Hero */}
            <section className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6 pt-4 sm:pt-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-medium text-text-muted shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>A Slow Media Journal</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-text leading-[1.12]">
                A quiet journal for everything you watch, read, and play.
              </h1>

              <p className="text-sm sm:text-lg text-text-muted font-sans leading-relaxed max-w-2xl mx-auto">
                meDiary is a calm, slow-paced media diary for logging and reviewing movies, TV shows, video games, and books. Keep private reflections or share your journey with friends—free from algorithmic clutter and distraction.
              </p>

              {/* Call-to-action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    setAuthModalMode("signup");
                    setIsAuthModalOpen(true);
                  }}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  className="shadow-md"
                >
                  Start Your Journal
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setAuthModalMode("login");
                    setIsAuthModalOpen(true);
                  }}
                >
                  Log In
                </Button>
              </div>
            </section>

            {/* Prominent Search Entry */}
            <section className="max-w-2xl mx-auto">
              <div
                onClick={() => openSearch()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSearch();
                  }
                }}
                className="group p-3.5 sm:p-4 rounded-2xl bg-surface border border-border shadow-md hover:border-accent/70 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Search className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="text-xs sm:text-sm font-medium text-text-muted group-hover:text-text transition-colors block truncate">
                      Search across movies, TV series, video games & books...
                    </span>
                    <span className="text-[10px] sm:text-xs text-text-muted/70 block">
                      Instant typo-tolerant search powered by Algolia
                    </span>
                  </div>
                </div>

                <div className="hidden xs:inline-flex items-center px-2 py-1 text-xs font-mono text-text-muted bg-bg rounded-lg border border-border group-hover:border-accent group-hover:text-text transition-colors shrink-0">
                  ⌘K
                </div>
              </div>

              {/* Quick Discovery Pills */}
              <div className="flex items-center justify-center gap-2 pt-3 flex-wrap">
                <span className="text-[11px] font-mono text-text-muted">Explore:</span>
                {[
                  { label: "Movies", query: "movies" },
                  { label: "TV Series", query: "series" },
                  { label: "Video Games", query: "games" },
                  { label: "Books", query: "books" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => openSearch(item.query)}
                    className="px-2.5 py-1 text-xs rounded-md bg-surface border border-border/80 text-text-muted hover:text-text hover:border-accent transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Trending now / Popular and new Section */}
            {trendingSection}

            {/* Popular right now (external trending) Section */}
            {popularSection}

            {/* Quiet Editorial Features */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-4">
              <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-base sm:text-lg font-bold text-text">
                  Tactile Rating Scales
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Choose 5-Star, 10-Point, 100-Point, or Thumbs Up/Down. Ratings normalize seamlessly across your journal.
                </p>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
                  <BookMarked className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-base sm:text-lg font-bold text-text">
                  Unified Slow Catalog
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Log cinema, television, literature, and gaming in one coherent archive without switching apps.
                </p>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-base sm:text-lg font-bold text-text">
                  Private or Public
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Keep entries private for your eyes only, or publish a public profile for friends to follow your taste.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* ============================================================== */}
        {/* SIGNED-IN VIEW                                                 */}
        {/* ============================================================== */}
        {user && (
          <div className="space-y-8 sm:space-y-12 animate-in fade-in duration-200">
            {/* 1. Warm Greeting & Quick Search Bar */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-border/70 pb-4">
                <div>
                  <h1 className="font-serif text-2xl sm:text-4xl font-black text-text tracking-tight">
                    {greeting}, {displayName}.
                  </h1>
                  <p className="text-xs sm:text-sm text-text-muted mt-1 font-sans">
                    Welcome back to your reading and viewing sanctuary.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/diary">
                    <Button variant="secondary" size="sm" leftIcon={<BookMarked className="w-3.5 h-3.5" />}>
                      My Diary
                    </Button>
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openSearch()}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Log Title
                  </Button>
                </div>
              </div>

              {/* Prominent Search Box */}
              <div
                onClick={() => openSearch()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSearch();
                  }
                }}
                className="group p-3.5 sm:p-4 rounded-2xl bg-surface border border-border shadow-xs hover:border-accent hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-accent text-accent-contrast flex items-center justify-center shrink-0 shadow-xs">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="text-xs sm:text-sm font-semibold text-text group-hover:text-accent transition-colors block truncate">
                      Search catalog or log a new title...
                    </span>
                    <span className="text-[11px] text-text-muted block">
                      Type to instantly search movies, shows, games, and books
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-text-muted bg-bg rounded-lg border border-border group-hover:border-accent group-hover:text-text transition-colors shrink-0">
                  <span>⌘K</span>
                </div>
              </div>
            </section>

            {/* 2. "Continue" Strip (In-Progress Entries) */}
            <section className="space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
                    Continue
                  </h2>
                  {!isLoadingDashboard && inProgressEntries.length > 0 && (
                    <Badge variant="forest" size="sm">
                      {inProgressEntries.length} in rotation
                    </Badge>
                  )}
                </div>

                <Link
                  href="/diary"
                  className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>Manage in diary</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Strip Content */}
              {isLoadingDashboard ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 card-depth">
                    <Skeleton className="w-14 h-20 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                      <Skeleton className="h-5 w-20 rounded-md" />
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 card-depth">
                    <Skeleton className="w-14 h-20 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                      <Skeleton className="h-5 w-20 rounded-md" />
                    </div>
                  </div>
                </div>
              ) : inProgressEntries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {inProgressEntries.map((entry) => {
                    const media = entry.media;
                    return (
                      <Link
                        key={entry.id}
                        href={`/media/${encodeURIComponent(entry.media_id)}`}
                        className="group p-3 sm:p-3.5 rounded-2xl bg-surface border border-border hover:border-accent card-depth transition-all flex items-center gap-3.5 cursor-pointer"
                      >
                        {/* Poster */}
                        <div className="relative w-14 sm:w-16 h-20 sm:h-22 rounded-xl overflow-hidden bg-bg/80 shrink-0 poster-depth-sm">
                          {media?.cover_url ? (
                            <Image
                              src={media.cover_url}
                              alt={media.title || "Media cover"}
                              fill
                              sizes="(max-width: 640px) 56px, 64px"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted font-serif text-sm">
                              {media?.title ? media.title.slice(0, 2).toUpperCase() : "??"}
                            </div>
                          )}
                        </div>

                        {/* Title & Progress details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant={getMediaBadgeVariant(media?.type)}
                              size="sm"
                              className="text-[9px] uppercase tracking-wider"
                            >
                              {media?.type || "media"}
                            </Badge>
                            {entry.progress?.season && entry.progress?.episode && (
                              <span className="text-[10px] font-mono text-accent font-semibold">
                                S{entry.progress.season} E{entry.progress.episode}
                              </span>
                            )}
                            {entry.progress?.percent && (
                              <span className="text-[10px] font-mono text-accent font-semibold">
                                {entry.progress.percent}% done
                              </span>
                            )}
                          </div>

                          <h3 className="font-serif text-sm sm:text-base font-bold text-text group-hover:text-accent transition-colors line-clamp-1">
                            {media?.title || "Untitled Entry"}
                          </h3>

                          <p className="text-[11px] text-text-muted line-clamp-1">
                            {media?.genres?.slice(0, 2).join(", ") || (media?.release_date ? new Date(media.release_date).getFullYear().toString() : "")}
                          </p>

                          <div className="pt-0.5 flex items-center gap-1 text-[11px] text-accent font-medium group-hover:translate-x-0.5 transition-transform">
                            <span>Continue</span>
                            <ChevronRight className="w-3 h-3" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                /* Empty In-Progress state */
                <div className="p-6 rounded-2xl bg-surface/60 border border-border/80 text-center space-y-2 card-depth">
                  <p className="text-xs sm:text-sm text-text-muted">
                    Nothing in progress right now. Found a new series, book, or game?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSearch()}
                    leftIcon={<Search className="w-3.5 h-3.5" />}
                  >
                    Search Catalog to Add
                  </Button>
                </div>
              )}
            </section>

            {/* 3. Most Recently Logged Titles */}
            <section className="space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center">
                    <BookMarked className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
                    Recently Logged
                  </h2>
                </div>

                <Link
                  href="/diary"
                  className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>{recentEntries.length > 0 ? `View all logs (${recentEntries.length})` : "View diary"}</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {isLoadingDashboard ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-surface border border-border space-y-2.5 card-depth">
                      <PosterSkeleton aspect="poster" />
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                  ))}
                </div>
              ) : recentEntries.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
                  {recentEntries.slice(0, 8).map((entry) => {
                    const media = entry.media;
                    return (
                      <Link
                        key={entry.id}
                        href={`/media/${encodeURIComponent(entry.media_id)}`}
                        className="group p-2.5 sm:p-3 rounded-2xl bg-surface border border-border hover:border-accent card-depth transition-all flex flex-col justify-between space-y-2.5 cursor-pointer"
                      >
                        {/* Poster */}
                        <div className="relative aspect-2/3 w-full rounded-xl overflow-hidden bg-bg/80 poster-depth-sm">
                          {media?.cover_url ? (
                            <Image
                              src={media.cover_url}
                              alt={media.title || "Cover"}
                              fill
                              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted font-serif text-lg font-bold">
                              {media?.title ? media.title.slice(0, 2).toUpperCase() : "??"}
                            </div>
                          )}

                          {/* Status Badge overlay */}
                          <div className="absolute top-2 left-2">
                            <Badge
                              variant={entry.status === "completed" ? "amber" : "subtle"}
                              size="sm"
                              className="text-[9px] uppercase tracking-wider backdrop-blur-md shadow-xs"
                            >
                              {getStatusLabel(entry.status)}
                            </Badge>
                          </div>
                        </div>

                        {/* Title & Metadata */}
                        <div className="space-y-1">
                          <h3 className="font-serif text-xs sm:text-sm font-bold text-text group-hover:text-accent transition-colors line-clamp-1">
                            {media?.title || "Untitled Entry"}
                          </h3>

                          <div className="flex items-center justify-between gap-1 text-[11px] text-text-muted">
                            <span className="truncate">
                              {media?.release_date ? new Date(media.release_date).getFullYear().toString() : media?.type || ""}
                            </span>
                            {entry.rating !== null && (
                              <RatingBadge rating={entry.rating} size="sm" showDenominator={false} />
                            )}
                          </div>

                          {entry.review && (
                            <p className="text-[11px] text-text-muted/80 line-clamp-2 italic pt-0.5">
                              &ldquo;{entry.review}&rdquo;
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                /* Empty recent logs state */
                <div className="p-8 rounded-2xl bg-surface/60 border border-border/80 text-center space-y-3 card-depth">
                  <p className="text-xs sm:text-sm text-text-muted">
                    No entries logged yet. Your journal is waiting for its first title!
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openSearch()}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Log Your First Title
                  </Button>
                </div>
              )}
            </section>

            {/* 4. Trending Now / Popular and New Section */}
            {trendingSection}

            {/* Popular right now (external trending) - placed above community section */}
            {popularSection}

            {/* 5. Friends & Community Activity Section */}
            <section className="pt-2">
              <ActivityFeed onOpenSearch={openSearch} />
            </section>
          </div>
        )}
      </main>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
      />

      {/* Global Media Search Modal */}
      <MediaSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        initialQuery={searchInitialQuery}
      />
    </div>
  );
}
