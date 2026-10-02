"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Star,
  EyeOff,
  Filter,
  ArrowUpDown,
  PenLine,
  CheckCircle2,
  Calendar,
  Tv,
  Gamepad2,
  BookOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { LogEntryModal } from "@/components/media/LogEntryModal";
import { SpoilerReviewText } from "@/components/media/SpoilerReviewText";
import { storedRatingToStars } from "@/lib/rating";
import type { MediaItem, ReviewItem, MediaEntry } from "@/types/database.types";

interface MediaReviewsFeedProps {
  media: MediaItem;
}

export function MediaReviewsFeed({ media }: MediaReviewsFeedProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<"recent" | "highest" | "lowest">("recent");
  const [filter, setFilter] = useState<"with_text" | "all">("with_text");
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userEntry, setUserEntry] = useState<MediaEntry | null>(null);

  // Helper to load reviews
  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/media/${media.id}/reviews?sort=${sort}&filter=${filter}`
      );
      if (res.ok) {
        const data = await res.json();
        let fetchedReviews: ReviewItem[] = Array.isArray(data.reviews)
          ? data.reviews
          : [];

        // Check localStorage for the user's latest review to ensure immediate reactivity
        if (typeof window !== "undefined") {
          try {
            const rawStored = localStorage.getItem("mediary_diary_entries");
            if (rawStored) {
              const localList = JSON.parse(rawStored);
              const localItem = localList.find(
                (item: { media_id: string }) => item.media_id === media.id
              );
              if (localItem && localItem.privacy !== "private") {
                const localReviewItem: ReviewItem = {
                  id: localItem.id || `local-${media.id}`,
                  user_id: user?.id || "current-user",
                  media_id: media.id,
                  status: localItem.status || "completed",
                  rating: localItem.rating ?? null,
                  progress: localItem.progress || null,
                  review: localItem.review || localItem.notes || null,
                  contains_spoilers: Boolean(
                    localItem.contains_spoilers || localItem.progress?.contains_spoilers
                  ),
                  privacy: localItem.privacy || "public",
                  created_at: localItem.logged_at || new Date().toISOString(),
                  updated_at: localItem.logged_at || new Date().toISOString(),
                  author: {
                    display_name: user?.user_metadata?.full_name || "You (Your review)",
                    avatar_url: null,
                  },
                };

                // Merge or replace user's review in the feed
                fetchedReviews = [
                  localReviewItem,
                  ...fetchedReviews.filter((r) => r.user_id !== user?.id && r.id !== localReviewItem.id),
                ];
              }
            }
          } catch (e) {
            console.error("Local reviews merge error:", e);
          }
        }

        setReviews(fetchedReviews);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setIsLoading(false);
    }
  }, [media.id, sort, filter, user]);

  // Initial load and on sort/filter change
  useEffect(() => {
    let cancelled = false;

    async function fetchOnMountOrChange() {
      try {
        const res = await fetch(
          `/api/media/${media.id}/reviews?sort=${sort}&filter=${filter}`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          let fetchedReviews: ReviewItem[] = Array.isArray(data.reviews)
            ? data.reviews
            : [];

          if (typeof window !== "undefined") {
            try {
              const rawStored = localStorage.getItem("mediary_diary_entries");
              if (rawStored) {
                const localList = JSON.parse(rawStored);
                const localItem = localList.find(
                  (item: { media_id: string }) => item.media_id === media.id
                );
                if (localItem && localItem.privacy !== "private") {
                  const localReviewItem: ReviewItem = {
                    id: localItem.id || `local-${media.id}`,
                    user_id: user?.id || "current-user",
                    media_id: media.id,
                    status: localItem.status || "completed",
                    rating: localItem.rating ?? null,
                    progress: localItem.progress || null,
                    review: localItem.review || localItem.notes || null,
                    contains_spoilers: Boolean(
                      localItem.contains_spoilers || localItem.progress?.contains_spoilers
                    ),
                    privacy: localItem.privacy || "public",
                    created_at: localItem.logged_at || new Date().toISOString(),
                    updated_at: localItem.logged_at || new Date().toISOString(),
                    author: {
                      display_name: user?.user_metadata?.full_name || "You (Your review)",
                      avatar_url: null,
                    },
                  };

                  fetchedReviews = [
                    localReviewItem,
                    ...fetchedReviews.filter((r) => r.user_id !== user?.id && r.id !== localReviewItem.id),
                  ];
                }
              }
            } catch (e) {
              console.error("Local reviews merge error:", e);
            }
          }

          if (!cancelled) {
            setReviews(fetchedReviews);
          }
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchOnMountOrChange();

    return () => {
      cancelled = true;
    };
  }, [media.id, sort, filter, user]);

  // Check user's own entry
  useEffect(() => {
    if (!user) return;
    async function checkMyEntry() {
      try {
        const res = await fetch(`/api/entries?media_id=${media.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.entry) {
            setUserEntry(data.entry);
          }
        }
      } catch (err) {
        console.error("Failed to check user entry:", err);
      }
    }
    checkMyEntry();
  }, [media.id, user]);

  const handleOpenReviewModal = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsLogModalOpen(true);
  };

  const handleReviewSaved = (saved: MediaEntry) => {
    setUserEntry(saved);
    loadReviews();
  };

  const spoilerCount = reviews.filter((r) => r.contains_spoilers).length;

  return (
    <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
                Community Reviews & Logs
              </h2>
              <Badge variant="subtle" size="sm" className="font-mono text-[11px]">
                {reviews.length} {reviews.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Reflections, ratings, and slow notes from fellow diary readers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenReviewModal}
            className="text-xs h-8 gap-1.5 shadow-2xs font-medium cursor-pointer"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>{userEntry ? "Edit Your Review" : "Write a Review"}</span>
          </Button>
        </div>
      </div>

      {/* 2. Filter & Sort Toolbar */}
      <div className="px-4 py-3 bg-bg/40 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1">
            <Filter className="w-3 h-3 text-accent" /> Filter:
          </span>

          <div className="flex items-center p-0.5 bg-surface rounded-md border border-border">
            <button
              type="button"
              onClick={() => setFilter("with_text")}
              className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                filter === "with_text"
                  ? "bg-accent text-accent-contrast font-medium shadow-2xs"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Written Reviews
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                filter === "all"
                  ? "bg-accent text-accent-contrast font-medium shadow-2xs"
                  : "text-text-muted hover:text-text"
              }`}
            >
              All Logs & Ratings
            </button>
          </div>

          {spoilerCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <EyeOff className="w-3 h-3" />
              <span>{spoilerCount} spoiler protected</span>
            </span>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-text-muted" /> Sort:
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "highest" | "lowest")}
            className="h-8 bg-surface border border-border rounded-md px-2.5 text-xs text-text focus:outline-none focus:border-accent cursor-pointer shadow-2xs"
          >
            <option value="recent">Most Recent (Default)</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>

          <button
            type="button"
            onClick={loadReviews}
            disabled={isLoading}
            className="p-1.5 rounded-md border border-border bg-surface text-text-muted hover:text-text transition-colors cursor-pointer"
            title="Refresh review feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>
      </div>

      {/* 3. Review Items Feed */}
      <div className="p-4 sm:p-5 space-y-4">
        {isLoading && reviews.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
            <p className="text-xs text-text-muted font-sans">
              Loading community reflections...
            </p>
          </div>
        ) : reviews.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border/80 bg-surface/30 space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent mx-auto flex items-center justify-center">
              <PenLine className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-serif text-base font-semibold text-text">
                Be the first to review {media.title}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Log your rating, thoughts, or reflections. You can tag spoilers to protect other readers.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenReviewModal}
              className="text-xs h-8 gap-1.5"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Write a Review</span>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {reviews.map((item) => {
              const stars = storedRatingToStars(item.rating);
              const authorName = item.author?.display_name || "Community Member";
              const authorInitial = authorName.charAt(0).toUpperCase();
              const isCurrentUser = item.user_id === user?.id;

              const prog = (item.progress as Record<string, unknown>) || {};
              const formattedDate = new Date(item.created_at).toLocaleDateString(
                "en-US",
                {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }
              );

              return (
                <article
                  key={item.id}
                  className="py-4 first:pt-0 last:pb-0 space-y-3 transition-colors"
                >
                  {/* Author Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      {/* Monogram Avatar */}
                      <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-xs font-serif font-bold shrink-0">
                        {authorInitial}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-serif text-xs sm:text-sm font-semibold text-text">
                            {authorName}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="subtle" size="sm" className="text-[10px] py-0 px-1.5">
                              You
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                          <Calendar className="w-3 h-3 text-text-muted/70" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating & Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {stars !== null && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-accent font-bold text-xs">
                          <Star className="w-3 h-3 fill-accent" />
                          <span>{stars.toFixed(1)} / 5</span>
                        </div>
                      )}

                      <Badge
                        variant={item.status === "completed" ? "forest" : "amber"}
                        size="sm"
                        className="capitalize text-[10px]"
                        dot
                        dotColor={item.status === "completed" ? "forest" : "amber"}
                      >
                        {item.status.replace("_", " ")}
                      </Badge>

                      {/* Progress Badge */}
                      {media.type === "tv" && (prog.season != null || prog.episode != null) && (
                        <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
                          <Tv className="w-2.5 h-2.5 mr-1" />
                          {prog.season != null ? `S${prog.season}` : ""}
                          {prog.season != null && prog.episode != null ? " · " : ""}
                          {prog.episode != null ? `Ep ${prog.episode}` : ""}
                        </Badge>
                      )}

                      {media.type === "game" && (prog.hoursPlayed != null || prog.completionPct != null || prog.platform != null) && (
                        <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
                          <Gamepad2 className="w-2.5 h-2.5 mr-1" />
                          {prog.hoursPlayed != null ? `${prog.hoursPlayed}h` : ""}
                          {prog.hoursPlayed != null && prog.completionPct != null ? " · " : ""}
                          {prog.completionPct != null ? `${prog.completionPct}%` : ""}
                          {prog.platform ? ` · ${String(prog.platform)}` : ""}
                        </Badge>
                      )}

                      {media.type === "book" && prog.pagesRead != null && (
                        <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
                          <BookOpen className="w-2.5 h-2.5 mr-1" />
                          p. {String(prog.pagesRead)}
                        </Badge>
                      )}

                      {item.contains_spoilers && (
                        <Badge variant="amber" size="sm" className="text-[10px] gap-1">
                          <EyeOff className="w-2.5 h-2.5" />
                          <span>Spoilers</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Review Text with Spoiler Protection */}
                  {item.review ? (
                    <SpoilerReviewText
                      text={item.review}
                      containsSpoilers={item.contains_spoilers}
                      isAuthor={isCurrentUser}
                    />
                  ) : (
                    <p className="text-xs italic text-text-muted/70">
                      Logged without written review notes.
                    </p>
                  )}

                  {/* Author Quick Actions */}
                  {isCurrentUser && (
                    <div className="pt-1 flex items-center justify-between text-[11px] text-text-muted">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Logged from your diary</span>
                      </span>

                      <button
                        type="button"
                        onClick={handleOpenReviewModal}
                        className="text-accent hover:underline cursor-pointer font-medium"
                      >
                        Edit review &rarr;
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Logging Modal */}
      <LogEntryModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        media={media}
        existingEntry={userEntry}
        onSaved={handleReviewSaved}
        onDeleted={() => {
          setUserEntry(null);
          loadReviews();
        }}
      />

      {/* Auth Modal for unauthenticated users */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="login"
      />
    </section>
  );
}
