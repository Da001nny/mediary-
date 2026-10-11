"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Film,
  Tv,
  Lock,
  Calendar,
  Star,
  ChevronRight,
  Loader2,
  AlertCircle,
  EyeOff,
  Settings,
} from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FollowButton } from "@/components/profile/FollowButton";
import { FollowListModal } from "@/components/profile/FollowListModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { LikeButton } from "@/components/social/LikeButton";
import { useAuth } from "@/context/AuthContext";
import type { MediaItem } from "@/types/database.types";

interface PublicLogItem {
  id: string;
  user_id: string;
  media_id: string;
  status: "planned" | "in_progress" | "completed" | "dropped" | "on_hold";
  rating: number | null;
  review: string | null;
  contains_spoilers?: boolean;
  privacy: string;
  created_at: string;
  media: MediaItem | null;
}

interface PublicUserData {
  profile: {
    id: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    region?: string | null;
    default_privacy: string;
    joined_at: string;
  };
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isPrivate: boolean;
  stats: {
    titlesLogged: number;
    moviesLogged: number;
    tvLogged: number;
    topGenres: { genre: string; count: number }[];
    averageRating: number | null;
  } | null;
  recentLogs: PublicLogItem[];
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const targetUserId = resolvedParams.id;
  const { user } = useAuth();

  const [data, setData] = useState<PublicUserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMediaFilter, setActiveMediaFilter] = useState<"all" | "movie" | "tv">("all");
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  // Follow list modal state
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<"followers" | "following">("followers");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);

      fetch(`/api/users/${targetUserId}`)
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 404) throw new Error("User profile not found");
            throw new Error("Failed to load user profile");
          }
          return res.json();
        })
        .then((resData) => {
          if (cancelled) return;
          setData(resData);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Profile load error:", err);
          setError(err instanceof Error ? err.message : "Error loading profile");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const getMonogram = (name: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isOwner = user && user.id === targetUserId;

  const toggleSpoiler = (logId: string) => {
    setRevealedSpoilers((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const openFollowersList = () => {
    setFollowModalTab("followers");
    setIsFollowModalOpen(true);
  };

  const openFollowingList = () => {
    setFollowModalTab("following");
    setIsFollowModalOpen(true);
  };

  // Filter logs by media type (Movies / TV focus)
  const filteredLogs = (data?.recentLogs || []).filter((log) => {
    if (activeMediaFilter === "all") return true;
    return log.media?.type === activeMediaFilter;
  });

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-accent/20">
      <TopNav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs font-mono text-text-muted">Loading profile...</p>
          </div>
        ) : error || !data ? (
          <div className="py-20 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-text">
              Profile Unavailable
            </h2>
            <p className="text-sm text-text-muted">
              {error || "We couldn't retrieve this member profile."}
            </p>
            <Link href="/">
              <Button variant="primary" size="sm">
                Return to Home
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Profile Header Card */}
            <div className="p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-surface border border-border/80 card-depth space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 sm:gap-5 min-w-0">
                  {/* Avatar or Monogram */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl overflow-hidden bg-accent/15 border-2 border-accent/25 text-accent flex items-center justify-center shrink-0 font-serif font-bold text-xl sm:text-2xl shadow-md ring-2 ring-black/5 dark:ring-white/5">
                    {data.profile.avatar_url ? (
                      <Image
                        src={data.profile.avatar_url}
                        alt={data.profile.display_name || "Profile avatar"}
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{getMonogram(data.profile.display_name)}</span>
                    )}
                  </div>

                  {/* Profile Name & Bio */}
                  <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-text truncate">
                        {data.profile.display_name || "Anonymous Member"}
                      </h1>
                      {data.isPrivate && (
                        <Badge variant="subtle" size="sm" className="gap-1 text-[10px]">
                          <Lock className="w-3 h-3 text-text-muted" />
                          <span>Private</span>
                        </Badge>
                      )}
                    </div>

                    {!data.isPrivate && (
                      data.profile.bio ? (
                        <p className="text-xs sm:text-sm text-text-muted max-w-xl leading-relaxed">
                          {data.profile.bio}
                        </p>
                      ) : (
                        <p className="text-xs text-text-muted/70 italic">
                          No bio provided yet.
                        </p>
                      )
                    )}

                    <div className="flex items-center gap-3 text-xs text-text-muted font-mono pt-0.5 flex-wrap">
                      {data.profile.joined_at && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-accent" />
                          <span>
                            Joined{" "}
                            {new Date(data.profile.joined_at).toLocaleDateString(undefined, {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Follow / Edit Profile Action Button */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 pt-1">
                  {isOwner ? (
                    <Link href="/settings">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Settings className="w-3.5 h-3.5" />}
                        className="text-xs font-semibold"
                      >
                        Edit Profile
                      </Button>
                    </Link>
                  ) : (
                    <FollowButton
                      targetUserId={targetUserId}
                      initialIsFollowing={data.isFollowing}
                      onFollowChange={(nextFollowing) => {
                        setData((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            isFollowing: nextFollowing,
                            followersCount: nextFollowing
                              ? prev.followersCount + 1
                              : Math.max(0, prev.followersCount - 1),
                          };
                        });
                      }}
                      onRequireAuth={() => setIsAuthModalOpen(true)}
                      size="md"
                      className="px-4 text-xs font-semibold"
                    />
                  )}
                </div>
              </div>

              {/* Follower and Following Counts (hidden for private profiles) */}
              {!data.isPrivate && (
                <div className="pt-3 border-t border-border/70 flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
                  <button
                    type="button"
                    onClick={openFollowersList}
                    className="group flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors"
                  >
                    <span className="font-bold font-mono text-text group-hover:text-accent text-sm sm:text-base">
                      {data.followersCount}
                    </span>
                    <span className="text-text-muted group-hover:text-text font-medium">
                      Followers
                    </span>
                  </button>

                  <div className="w-1 h-1 rounded-full bg-border" />

                  <button
                    type="button"
                    onClick={openFollowingList}
                    className="group flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors"
                  >
                    <span className="font-bold font-mono text-text group-hover:text-accent text-sm sm:text-base">
                      {data.followingCount}
                    </span>
                    <span className="text-text-muted group-hover:text-text font-medium">
                      Following
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Privacy Check: If profile is private and viewer is not owner, show minimal state */}
            {data.isPrivate ? (
              <div className="p-8 sm:p-12 rounded-2xl sm:rounded-3xl bg-surface border border-border/80 card-depth text-center space-y-4 max-w-xl mx-auto my-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface-hover border border-border flex items-center justify-center mx-auto text-text-muted shadow-xs">
                  <Lock className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-text">
                    This Profile is Private
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mx-auto">
                    This member has chosen to keep their logs and media entries private. Follow this user to stay connected.
                  </p>
                </div>
              </div>
            ) : (
              /* Public Content: Stats, Top Genres & Recent Public Logs */
              <>
                {/* Stats Highlights (Movies & TV Focus) */}
                {data.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border/80 card-depth space-y-1">
                      <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-text-muted">
                        Titles Logged
                      </span>
                      <p className="font-serif text-xl sm:text-2xl font-bold text-text">
                        {data.stats.titlesLogged}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border/80 card-depth space-y-1">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-text-muted">
                        <span>Movies</span>
                        <Film className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="font-serif text-xl sm:text-2xl font-bold text-text">
                        {data.stats.moviesLogged}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border/80 card-depth space-y-1">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-text-muted">
                        <span>TV Series</span>
                        <Tv className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="font-serif text-xl sm:text-2xl font-bold text-text">
                        {data.stats.tvLogged}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-surface border border-border/80 card-depth space-y-1">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-text-muted">
                        <span>Avg Rating</span>
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      </div>
                      <p className="font-serif text-xl sm:text-2xl font-bold text-text">
                        {data.stats.averageRating !== null
                          ? `${(data.stats.averageRating / 10).toFixed(1)} / 10`
                          : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Top Genres Section */}
                {data.stats?.topGenres && data.stats.topGenres.length > 0 && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 card-depth space-y-2.5">
                    <h3 className="font-serif text-sm sm:text-base font-bold text-text flex items-center gap-1.5">
                      <span>Favorite Genres</span>
                    </h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {data.stats.topGenres.map(({ genre, count }) => (
                        <span
                          key={genre}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg border border-border text-text flex items-center gap-1.5"
                        >
                          <span>{genre}</span>
                          <span className="font-mono text-[10px] text-accent opacity-90">
                            {count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Public Logs Feed (Movies/TV focus) */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-base sm:text-lg font-bold text-text">
                        Public Journal Entries
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface border border-border text-text-muted">
                        {filteredLogs.length}
                      </span>
                    </div>

                    {/* Filter Tabs: All / Movies / TV */}
                    <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border self-start sm:self-auto text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveMediaFilter("all")}
                        className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          activeMediaFilter === "all"
                            ? "bg-accent text-accent-contrast shadow-2xs"
                            : "text-text-muted hover:text-text"
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMediaFilter("movie")}
                        className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          activeMediaFilter === "movie"
                            ? "bg-accent text-accent-contrast shadow-2xs"
                            : "text-text-muted hover:text-text"
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>Movies</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMediaFilter("tv")}
                        className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          activeMediaFilter === "tv"
                            ? "bg-accent text-accent-contrast shadow-2xs"
                            : "text-text-muted hover:text-text"
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>TV</span>
                      </button>
                    </div>
                  </div>

                  {filteredLogs.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center rounded-2xl bg-surface border border-border/80 card-depth space-y-2">
                      <p className="font-serif text-sm sm:text-base font-bold text-text">
                        No public entries in this category
                      </p>
                      <p className="text-xs text-text-muted max-w-sm mx-auto">
                        This member hasn&rsquo;t published any public movie or TV logs yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                      {filteredLogs.map((log) => {
                        const media = log.media;
                        if (!media) return null;

                        const isSpoilerRevealed = Boolean(revealedSpoilers[log.id]);

                        return (
                          <div
                            key={log.id}
                            className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border/80 card-depth card-depth-hover transition-all flex flex-col justify-between space-y-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              {/* Poster */}
                              <Link
                                href={`/media/${media.id}`}
                                className="relative w-14 sm:w-16 aspect-2/3 rounded-lg overflow-hidden bg-bg shrink-0 poster-depth ring-1 ring-black/10 dark:ring-white/10 hover:opacity-90 transition-opacity"
                              >
                                {media.cover_url ? (
                                  <Image
                                    src={media.cover_url}
                                    alt={media.title}
                                    fill
                                    sizes="64px"
                                    className="object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-surface-hover text-text-muted">
                                    <Film className="w-4 h-4 opacity-50" />
                                  </div>
                                )}
                              </Link>

                              {/* Title & Log Details */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <Link
                                  href={`/media/${media.id}`}
                                  className="font-serif text-sm sm:text-base font-bold text-text truncate hover:text-accent transition-colors block"
                                >
                                  {media.title}
                                </Link>

                                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                  <Badge
                                    variant={
                                      media.type === "movie"
                                        ? "amber"
                                        : media.type === "tv"
                                        ? "forest"
                                        : "subtle"
                                    }
                                    size="sm"
                                    className="capitalize text-[10px]"
                                  >
                                    {media.type}
                                  </Badge>

                                  <span className="capitalize text-[11px] font-mono text-text-muted">
                                    {log.status.replace("_", " ")}
                                  </span>

                                  {media.release_date && (
                                    <span className="text-[11px] font-mono text-text-muted">
                                      {media.release_date.slice(0, 4)}
                                    </span>
                                  )}
                                </div>

                                {log.rating !== null && log.rating > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold pt-0.5">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    <span>{(log.rating / 10).toFixed(1)} / 10</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Review text if available */}
                            {log.review && (
                              <div className="pt-2 border-t border-border/60 text-xs">
                                {log.contains_spoilers && !isSpoilerRevealed ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleSpoiler(log.id)}
                                    className="w-full py-2 px-3 rounded-lg bg-bg border border-amber-950/20 text-amber-700 dark:text-amber-400 flex items-center justify-between text-left cursor-pointer hover:bg-surface transition-colors"
                                  >
                                    <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                                      <EyeOff className="w-3.5 h-3.5" />
                                      <span>Review contains spoilers</span>
                                    </span>
                                    <span className="underline text-[10px]">Reveal</span>
                                  </button>
                                ) : (
                                  <div className="space-y-1">
                                    {log.contains_spoilers && (
                                      <div className="flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                        <span>Spoilers revealed</span>
                                        <button
                                          type="button"
                                          onClick={() => toggleSpoiler(log.id)}
                                          className="underline cursor-pointer"
                                        >
                                          Hide
                                        </button>
                                      </div>
                                    )}
                                    <p className="text-text-muted italic leading-relaxed line-clamp-3">
                                      &ldquo;{log.review}&rdquo;
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Card Footer: Log date, like button and view title link */}
                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 text-[11px] font-mono text-text-muted">
                              <span>
                                {new Date(log.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>

                              <div className="flex items-center gap-2">
                                <LikeButton
                                  entryId={log.id}
                                  mediaType={media.type}
                                  size="sm"
                                />
                                <Link
                                  href={`/media/${media.id}`}
                                  className="inline-flex items-center gap-1 text-accent hover:underline font-semibold"
                                >
                                  <span>Details</span>
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Network Modal (Followers and Following List) */}
      {data && (
        <FollowListModal
          isOpen={isFollowModalOpen}
          onClose={() => setIsFollowModalOpen(false)}
          userId={targetUserId}
          userName={data.profile.display_name || "Member"}
          initialTab={followModalTab}
          followersCount={data.followersCount}
          followingCount={data.followingCount}
          onRequireAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Auth Modal if unauthenticated user clicks Follow */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="login"
      />
    </div>
  );
}
