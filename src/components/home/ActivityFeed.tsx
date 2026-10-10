"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  Search,
  Clock,
  Film,
  Tv,
  ChevronDown,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { SpoilerReviewText } from "@/components/media/SpoilerReviewText";
import type { FeedItem } from "@/app/api/activity/route";

interface ActivityFeedProps {
  onOpenSearch?: () => void;
}

/**
 * Format timestamp into human relative time ("2m ago", "4h ago", "3d ago", etc.)
 */
function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

/**
 * Extracts a 1- or 2-letter monogram from display name
 */
function getMonogram(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ActivityFeed({ onOpenSearch }: ActivityFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<"no_following" | "no_activity" | null>(null);
  const [followingCount, setFollowingCount] = useState<number>(0);

  useEffect(() => {
    let ignore = false;

    async function loadFeed() {
      try {
        const res = await fetch("/api/activity?limit=30");
        if (!res.ok) throw new Error("Failed to load activity feed");
        const data = await res.json();
        if (!ignore) {
          setItems(data.items || []);
          setFollowingCount(data.followingCount ?? 0);
          if ((data.items || []).length === 0) {
            setEmptyReason(data.reason || (data.followingCount === 0 ? "no_following" : "no_activity"));
          } else {
            setEmptyReason(null);
          }
          setHasMore(Boolean(data.hasMore));
          setNextCursor(data.nextCursor || null);
        }
      } catch (err) {
        console.error("Error fetching activity feed:", err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadFeed();
    return () => {
      ignore = true;
    };
  }, []);

  const handleLoadMore = async () => {
    if (isLoadingMore || !nextCursor) return;
    try {
      setIsLoadingMore(true);
      const url = `/api/activity?cursor=${encodeURIComponent(nextCursor)}&limit=30`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load activity feed");
      const data = await res.json();
      setItems((prev) => [...prev, ...(data.items || [])]);
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error("Error loading more items:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Feed Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
              Friends & Community Activity
            </h2>
            <p className="text-[11px] text-text-muted">
              Live cinema and television log stream from people you follow
            </p>
          </div>
        </div>

        {!isLoading && items.length > 0 && (
          <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
            {items.length} {items.length === 1 ? "update" : "updates"}
          </Badge>
        )}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-3.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/70 animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-border/60" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 bg-border/60 rounded" />
                    <div className="w-20 h-2.5 bg-border/40 rounded" />
                  </div>
                </div>
                <div className="w-12 h-3 bg-border/40 rounded" />
              </div>
              <div className="flex gap-4 pt-1">
                <div className="w-14 sm:w-16 h-20 sm:h-24 bg-border/60 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="w-3/4 h-4 bg-border/60 rounded" />
                  <div className="w-20 h-5 bg-border/40 rounded" />
                  <div className="w-full h-8 bg-border/30 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State: You follow nobody */}
      {!isLoading && items.length === 0 && emptyReason === "no_following" && (
        <div className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-border/90 bg-surface/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-accent shadow-2xs">
            <Users className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-serif text-base sm:text-lg font-bold text-text">
              You aren&apos;t following anyone yet
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              meDiary is richer with friends. Search for cinema and TV lovers, discover public profiles, and follow them to stream their latest logs, ratings, and reviews here.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            {onOpenSearch && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenSearch}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                Search Catalog & Members
              </Button>
            )}
            <Link href="/dev">
              <Button variant="secondary" size="sm">
                Explore Directory
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Empty State: Followed people have no activity */}
      {!isLoading && items.length === 0 && emptyReason === "no_activity" && (
        <div className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-border/90 bg-surface/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-accent shadow-2xs">
            <Clock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-serif text-base sm:text-lg font-bold text-text">
              The people you follow have no activity yet
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              You are following {followingCount} {followingCount === 1 ? "member" : "members"}, but they haven&apos;t logged or reviewed any films or television shows recently. As soon as they share an entry, it will stream here.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            {onOpenSearch && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenSearch}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                Find More Members
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Feed Items List */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-3.5">
          {items.map((item) => {
            const actionLabel =
              item.type === "reviewed"
                ? "reviewed"
                : item.type === "listed"
                ? "created a list"
                : item.type === "followed"
                ? "started following"
                : item.status === "completed"
                ? "logged as watched"
                : item.status === "in_progress"
                ? "is currently watching"
                : "logged";

            return (
              <article
                key={item.id}
                className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 shadow-2xs hover:border-border transition-all space-y-3.5"
              >
                {/* Author Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/u/${item.user.id}`}
                      className="shrink-0 relative group"
                    >
                      {item.user.avatar_url ? (
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-border group-hover:border-accent transition-colors relative bg-surface">
                          <Image
                            src={item.user.avatar_url}
                            alt={item.user.display_name}
                            fill
                            className="object-cover"
                            sizes="40px"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-xs font-bold font-mono group-hover:bg-accent/25 transition-colors">
                          {getMonogram(item.user.display_name)}
                        </div>
                      )}
                    </Link>

                    <div className="min-w-0 text-left">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <Link
                          href={`/u/${item.user.id}`}
                          className="font-serif font-bold text-sm sm:text-base text-text hover:text-accent transition-colors truncate"
                        >
                          {item.user.display_name}
                        </Link>
                        <span className="text-xs text-text-muted">
                          {actionLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-text-muted">
                        <span>{formatTimeAgo(item.created_at)}</span>
                        {item.privacy === "friends" && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-accent-secondary">
                              Friends only
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rating Badge in Viewer's Scale */}
                  {item.rating !== null && item.rating !== undefined && (
                    <div className="shrink-0">
                      <RatingBadge rating={item.rating} size="sm" />
                    </div>
                  )}
                </div>

                {/* Media Row: Poster, Title, Rating, and Review */}
                {item.media && (
                  <div className="flex items-start gap-3.5 sm:gap-4 p-3 rounded-xl bg-bg/60 border border-border/50">
                    {/* Poster Link */}
                    <Link
                      href={`/media/${item.media.id}`}
                      className="relative shrink-0 w-14 sm:w-16 aspect-2/3 rounded-lg overflow-hidden bg-surface border border-border group shadow-2xs hover:border-accent transition-colors"
                    >
                      {item.media.cover_url ? (
                        <Image
                          src={item.media.cover_url}
                          alt={item.media.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="64px"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-surface text-text-muted">
                          {item.media.type === "tv" ? (
                            <Tv className="w-4 h-4 opacity-40 mb-1" />
                          ) : (
                            <Film className="w-4 h-4 opacity-40 mb-1" />
                          )}
                          <span className="text-[9px] line-clamp-2">
                            {item.media.title}
                          </span>
                        </div>
                      )}
                    </Link>

                    {/* Metadata & Review */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link
                          href={`/media/${item.media.id}`}
                          className="font-serif font-bold text-sm sm:text-base text-text hover:text-accent transition-colors line-clamp-1"
                        >
                          {item.media.title}
                        </Link>
                        {item.media.release_date && (
                          <span className="text-[11px] font-mono text-text-muted shrink-0">
                            {item.media.release_date.slice(0, 4)}
                          </span>
                        )}
                      </div>

                      {/* Spoiler-protected review text */}
                      {item.review && (
                        <div className="pt-0.5">
                          <SpoilerReviewText
                            text={item.review}
                            containsSpoilers={item.contains_spoilers}
                            className="text-xs sm:text-sm text-text/90"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* List Row for 'listed' activity */}
                {item.type === "listed" && !item.media && (
                  <div className="flex items-start gap-3.5 sm:gap-4 p-3 rounded-xl bg-bg/60 border border-border/50">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/lists/${item.ref_id}`}
                        className="font-serif font-bold text-sm sm:text-base text-text hover:text-accent transition-colors line-clamp-1 block"
                      >
                        {String(item.data?.name || item.data?.title || "Custom List")}
                      </Link>
                      {Boolean(item.data?.description) && (
                        <p className="text-xs text-text-muted line-clamp-2">
                          {String(item.data?.description)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {/* Load More Button using Cursor Pagination */}
          {hasMore && (
            <div className="pt-2 text-center">
              <Button
                variant="secondary"
                size="md"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                leftIcon={
                  isLoadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                }
              >
                {isLoadingMore ? "Loading more updates..." : "Load More Activity"}
              </Button>
            </div>
          )}

          {!hasMore && items.length >= 30 && (
            <p className="text-center text-xs text-text-muted pt-2">
              You&apos;re all caught up with your friends&apos; activity.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
