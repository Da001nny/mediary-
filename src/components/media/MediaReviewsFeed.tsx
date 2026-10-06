"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  EyeOff,
  Filter,
  ArrowUpDown,
  PenLine,
  CheckCircle2,
  Calendar,
  Tv,
  Gamepad2,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { LogEntryModal } from "@/components/media/LogEntryModal";
import { SpoilerReviewText } from "@/components/media/SpoilerReviewText";
import { CardSkeleton } from "@/components/ui/Skeleton";
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
    <section className="card-depth rounded-2xl overflow-hidden transition-all">
      {/* 1. Header Bar with generous spacing */}
      <div className="p-4 sm:p-8 lg:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-b border-border/70 bg-surface/50">
        <div className="flex items-center gap-3.5 sm:gap-5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0 shadow-2xs">
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="font-serif text-xl sm:text-3xl font-extrabold text-text">
                Community Reviews & Logs
              </h2>
              <Badge variant="subtle" size="sm" className="font-mono text-[10px] sm:text-xs">
                {reviews.length} {reviews.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 sm:mt-1 leading-relaxed">
              Reflections, ratings, and slow notes from fellow diary readers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenReviewModal}
            className="text-xs font-semibold h-10 sm:h-11 px-4 sm:px-5 gap-2 shadow-sm hover:shadow-md cursor-pointer"
          >
            <PenLine className="w-4 h-4" />
            <span>{userEntry ? "Edit Your Review" : "Write a Review"}</span>
          </Button>
        </div>
      </div>

      {/* 2. Filter & Sort Toolbar */}
      <div className="px-3.5 sm:px-8 py-3 sm:py-4 bg-bg/50 border-b border-border/60 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-semibold">
            <Filter className="w-3.5 h-3.5 text-accent" /> Filter:
          </span>

          <div className="flex items-center p-1 bg-surface rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setFilter("with_text")}
              className={`px-2.5 sm:px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                filter === "with_text"
                  ? "bg-accent text-accent-contrast font-semibold shadow-2xs"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Written Reviews
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 sm:px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-accent text-accent-contrast font-semibold shadow-2xs"
                  : "text-text-muted hover:text-text"
              }`}
            >
              All Logs & Ratings
            </button>
          </div>

          {spoilerCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <EyeOff className="w-3.5 h-3.5" />
              <span>{spoilerCount} spoiler protected</span>
            </span>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted flex items-center gap-1 font-semibold">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" /> Sort:
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "highest" | "lowest")}
            className="h-9 bg-surface border border-border rounded-xl px-2.5 sm:px-3 text-xs text-text font-medium focus:outline-none focus:border-accent cursor-pointer shadow-2xs"
          >
            <option value="recent">Most Recent (Default)</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>

          <button
            type="button"
            onClick={loadReviews}
            disabled={isLoading}
            className="p-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text hover:border-accent/40 transition-colors cursor-pointer shadow-2xs"
            title="Refresh review feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>
      </div>

      {/* 3. Review Items Feed */}
      <div className="p-3.5 sm:p-8 lg:p-10 space-y-4 sm:space-y-6">
        {isLoading && reviews.length === 0 ? (
          <div className="space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : reviews.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-border/80 bg-surface/30 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 text-accent mx-auto flex items-center justify-center shadow-2xs">
              <PenLine className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="font-serif text-xl font-bold text-text">
                Be the first to review {media.title}
              </h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Log your rating, thoughts, or reflections. You can tag spoilers to protect other readers.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenReviewModal}
              className="text-xs h-10 px-5 gap-2 font-semibold shadow-xs"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Write a Review</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((item) => {
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
                  className="p-6 sm:p-7 rounded-2xl card-depth card-depth-hover space-y-4 transition-all"
                >
                  {/* Author Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Monogram Avatar */}
                      <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-xs font-serif font-bold shrink-0 shadow-2xs">
                        {authorInitial}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-sm sm:text-base font-bold text-text">
                            {authorName}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="subtle" size="sm" className="text-[10px] py-0 px-2 font-mono">
                              You
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Calendar className="w-3 h-3 text-text-muted/70" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating & Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.rating !== null && item.rating !== undefined && (
                        <RatingBadge rating={item.rating} size="sm" />
                      )}

                      <Badge
                        variant={item.status === "completed" ? "forest" : "amber"}
                        size="sm"
                        className="capitalize text-xs font-semibold px-2.5 py-0.5"
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
