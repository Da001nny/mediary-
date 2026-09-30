"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Star,
  Bookmark,
  PlayCircle,
  CheckCircle,
  XCircle,
  PauseCircle,
  Globe,
  Users as UsersIcon,
  Lock,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  Tv,
  Gamepad2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MediaItem, EntryStatus, PrivacyLevel, MediaEntry } from "@/types/database.types";

interface LogEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem;
  existingEntry?: Partial<MediaEntry> | null;
  onSaved?: (entry: MediaEntry) => void;
  onDeleted?: () => void;
}

const STATUS_CONFIG: Array<{
  value: EntryStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeVariant: "amber" | "forest" | "subtle";
}> = [
  {
    value: "planned",
    label: "Planned",
    description: "Want to watch or experience later",
    icon: Bookmark,
    badgeVariant: "amber",
  },
  {
    value: "in_progress",
    label: "In Progress",
    description: "Currently watching or reading",
    icon: PlayCircle,
    badgeVariant: "amber",
  },
  {
    value: "completed",
    label: "Completed",
    description: "Finished and reviewed",
    icon: CheckCircle,
    badgeVariant: "forest",
  },
  {
    value: "on_hold",
    label: "On Hold",
    description: "Temporarily paused",
    icon: PauseCircle,
    badgeVariant: "subtle",
  },
  {
    value: "dropped",
    label: "Dropped",
    description: "Did not finish or abandoned",
    icon: XCircle,
    badgeVariant: "subtle",
  },
];

const RATING_LABELS: Record<number, string> = {
  0.5: "0.5 — Waste of time",
  1.0: "1.0 — Very poor",
  1.5: "1.5 — Poor",
  2.0: "2.0 — Mediocre",
  2.5: "2.5 — Average",
  3.0: "3.0 — Decent",
  3.5: "3.5 — Good",
  4.0: "4.0 — Very good",
  4.5: "4.5 — Excellent",
  5.0: "5.0 — Masterpiece",
};

/**
 * Converts stored 0-100 normalized rating to 0.5-5.0 star rating.
 * E.g. 70 -> 3.5, 100 -> 5.0, 10 -> 0.5.
 * Also handles legacy 0-5 values if present.
 */
export function storedRatingToStars(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined) return null;
  if (stored <= 0) return null;
  // If stored rating is in legacy 0-5 decimal scale
  if (stored <= 5 && !Number.isInteger(stored)) {
    return Math.round(stored * 2) / 2;
  }
  if (stored <= 5) {
    // If integer <= 5 from early legacy entries
    return Math.round(stored * 2) / 2;
  }
  // Normalized 0-100 scale: e.g. 70 / 20 = 3.5 stars
  const stars = Math.round((stored / 20) * 2) / 2;
  return Math.min(5, Math.max(0.5, stars));
}

/**
 * Converts 0.5-5.0 star selection to 0-100 normalized stored rating.
 * E.g. 3.5 -> 70, 5.0 -> 100, 0.5 -> 10.
 */
export function starsToStoredRating(stars: number | null | undefined): number | null {
  if (stars === null || stars === undefined) return null;
  return Math.min(100, Math.max(0, Math.round(stars * 20)));
}

export function LogEntryModal(props: LogEntryModalProps) {
  if (!props.isOpen) return null;

  return (
    <LogEntryModalContent
      key={`${props.media.id}-${props.existingEntry?.id || "new"}-${props.existingEntry?.updated_at || "0"}`}
      {...props}
    />
  );
}

function LogEntryModalContent({
  isOpen,
  onClose,
  media,
  existingEntry,
  onSaved,
  onDeleted,
}: LogEntryModalProps) {
  const [status, setStatus] = useState<EntryStatus>(
    existingEntry?.status || "completed"
  );

  // Stored rating is normalized 0-100, converted to 0.5-5.0 stars for the 5-star UI
  const [starRating, setStarRating] = useState<number | null>(() =>
    storedRatingToStars(existingEntry?.rating)
  );
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Extract existing media-specific progress
  const existingProgress =
    existingEntry?.progress && typeof existingEntry.progress === "object"
      ? (existingEntry.progress as Record<string, unknown>)
      : null;

  // TV Progress: { season, episode }
  const [tvSeason, setTvSeason] = useState<string>(() =>
    existingProgress?.season !== undefined && existingProgress.season !== null
      ? String(existingProgress.season)
      : ""
  );
  const [tvEpisode, setTvEpisode] = useState<string>(() =>
    existingProgress?.episode !== undefined && existingProgress.episode !== null
      ? String(existingProgress.episode)
      : ""
  );

  // Game Progress: { hoursPlayed, completionPct, platform }
  const typeSpecific = (media.type_specific as Record<string, unknown>) || {};
  const gamePlatforms = (Array.isArray(typeSpecific.platforms)
    ? typeSpecific.platforms
    : []) as string[];

  const [gameHours, setGameHours] = useState<string>(() =>
    existingProgress?.hoursPlayed !== undefined && existingProgress.hoursPlayed !== null
      ? String(existingProgress.hoursPlayed)
      : ""
  );
  const [gameCompletion, setGameCompletion] = useState<string>(() =>
    existingProgress?.completionPct !== undefined && existingProgress.completionPct !== null
      ? String(existingProgress.completionPct)
      : ""
  );
  const [gamePlatform, setGamePlatform] = useState<string>(() =>
    typeof existingProgress?.platform === "string"
      ? existingProgress.platform
      : typeof typeSpecific?.platform_played_on === "string"
      ? typeSpecific.platform_played_on
      : ""
  );

  // Book Progress: { pagesRead }
  const [bookPages, setBookPages] = useState<string>(() =>
    existingProgress?.pagesRead !== undefined && existingProgress.pagesRead !== null
      ? String(existingProgress.pagesRead)
      : ""
  );

  const [review, setReview] = useState<string>(existingEntry?.review || "");
  const [privacy, setPrivacy] = useState<PrivacyLevel>(
    existingEntry?.privacy || "public"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState(false);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const releaseYear = media.release_date
    ? new Date(media.release_date).getFullYear()
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // 1. Normalize rating 0-100 (e.g. 3.5 stars -> 70, 5 stars -> 100)
      const normalizedRating = starsToStoredRating(starRating);

      // 2. Build media-specific progress payload
      let progressPayload: Record<string, unknown> | null = null;
      if (media.type === "tv") {
        const s = tvSeason.trim() ? parseInt(tvSeason, 10) : null;
        const ep = tvEpisode.trim() ? parseInt(tvEpisode, 10) : null;
        progressPayload = {};
        if (s !== null && !isNaN(s)) progressPayload.season = s;
        if (ep !== null && !isNaN(ep)) progressPayload.episode = ep;
      } else if (media.type === "game") {
        const h = gameHours.trim() ? parseFloat(gameHours) : null;
        const pct = gameCompletion.trim() ? parseFloat(gameCompletion) : null;
        progressPayload = {};
        if (h !== null && !isNaN(h)) progressPayload.hoursPlayed = h;
        if (pct !== null && !isNaN(pct))
          progressPayload.completionPct = Math.min(100, Math.max(0, pct));
        if (gamePlatform.trim()) progressPayload.platform = gamePlatform.trim();
      } else if (media.type === "book") {
        const p = bookPages.trim() ? parseInt(bookPages, 10) : null;
        progressPayload = {};
        if (p !== null && !isNaN(p)) progressPayload.pagesRead = p;
      } else {
        // Movies: null or empty
        progressPayload = null;
      }

      const payload = {
        media_id: media.id,
        title: media.title,
        media_type: media.type,
        cover_url: media.cover_url,
        status,
        rating: normalizedRating,
        progress: progressPayload,
        review: review.trim() || null,
        privacy,
      };

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to log entry");
      }

      // Sync to localStorage for immediate reactive update across /diary
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("mediary_diary_entries");
          const localEntries = stored ? JSON.parse(stored) : [];
          const newEntryData = {
            id: data.entry?.id || `log-${Date.now()}`,
            media_id: media.id,
            title: media.title,
            type: media.type,
            cover_url: media.cover_url,
            release_year: releaseYear,
            genres: media.genres,
            status,
            rating: normalizedRating, // stored 0-100 normalized
            star_rating: starRating, // 0.5-5.0 display scale
            progress: progressPayload,
            notes: review.trim() || null,
            privacy,
            logged_at: new Date().toISOString(),
          };

          const filtered = localEntries.filter(
            (entryItem: { media_id: string }) => entryItem.media_id !== media.id
          );
          filtered.unshift(newEntryData);
          localStorage.setItem(
            "mediary_diary_entries",
            JSON.stringify(filtered)
          );
        }
      } catch (localErr) {
        console.error("Local sync error:", localErr);
      }

      setSuccessNotice(true);
      if (onSaved) {
        onSaved(data.entry);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Error saving log entry");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this log from your diary?")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await fetch(`/api/entries?media_id=${media.id}`, {
        method: "DELETE",
      });

      // Remove from localStorage
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("mediary_diary_entries");
          if (stored) {
            const localEntries = JSON.parse(stored);
            const filtered = localEntries.filter(
              (e: { media_id: string }) => e.media_id !== media.id
            );
            localStorage.setItem(
              "mediary_diary_entries",
              JSON.stringify(filtered)
            );
          }
        }
      } catch (e) {
        console.error("Local removal error:", e);
      }

      if (onDeleted) {
        onDeleted();
      }
      setIsDeleting(false);
      onClose();
    } catch (err) {
      setIsDeleting(false);
      setError(err instanceof Error ? err.message : "Error removing entry");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-entry-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border bg-surface-hover/30 flex items-start justify-between gap-4">
          <div className="flex gap-3.5 items-center">
            {/* Media thumbnail */}
            <div className="relative w-12 h-16 rounded-md overflow-hidden bg-bg border border-border shrink-0 shadow-2xs">
              {media.cover_url ? (
                <Image
                  src={media.cover_url}
                  alt={media.title}
                  fill
                  sizes="48px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted">
                  No art
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="w-3.5 h-3.5" />
                <span>meDiary Journal Entry</span>
              </div>
              <h2
                id="log-entry-title"
                className="font-serif text-xl sm:text-2xl font-bold text-text leading-tight"
              >
                {media.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                <span className="capitalize">{media.type}</span>
                {releaseYear && <span>· {releaseYear}</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>Log entry saved to your media diary!</span>
            </div>
          )}

          {/* 1. Status Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center justify-between">
              <span>Status</span>
              <span className="text-[11px] text-text-muted font-normal">
                Required
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATUS_CONFIG.map((opt) => {
                const isSelected = status === opt.value;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium border transition-all text-left cursor-pointer ${
                      isSelected
                        ? "bg-accent/15 border-accent text-accent shadow-2xs font-semibold"
                        : "bg-bg text-text border-border hover:border-text/25 hover:bg-surface-hover"
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-accent" : "text-text-muted"
                      }`}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Media-Specific Progress Tracking ({season, episode} for TV, {hoursPlayed, completionPct} for games, {pagesRead} for books) */}
          {media.type === "tv" && (
            <div className="space-y-2 p-3.5 bg-bg rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-accent" />
                  <span>Watching Progress</span>
                </label>
                <span className="text-[11px] text-text-muted">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    Season
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 2"
                    value={tvSeason}
                    onChange={(e) => setTvSeason(e.target.value)}
                    className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    Episode
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    placeholder="e.g. 8"
                    value={tvEpisode}
                    onChange={(e) => setTvEpisode(e.target.value)}
                    className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          )}

          {media.type === "game" && (
            <div className="space-y-2 p-3.5 bg-bg rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-accent" />
                  <span>Gameplay Progress</span>
                </label>
                <span className="text-[11px] text-text-muted">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    Hours Played
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 35.5"
                    value={gameHours}
                    onChange={(e) => setGameHours(e.target.value)}
                    className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">
                    Completion %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 85"
                    value={gameCompletion}
                    onChange={(e) => setGameCompletion(e.target.value)}
                    className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1">
                  Platform Played On
                </label>
                <input
                  type="text"
                  placeholder="e.g. PC, PlayStation 5, Switch"
                  value={gamePlatform}
                  onChange={(e) => setGamePlatform(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent mb-1.5"
                />
                {gamePlatforms.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {gamePlatforms.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setGamePlatform(p)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          gamePlatform === p
                            ? "bg-accent/20 border-accent text-accent font-semibold"
                            : "bg-surface border-border text-text-muted hover:text-text"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {media.type === "book" && (
            <div className="space-y-2 p-3.5 bg-bg rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-accent" />
                  <span>Reading Progress</span>
                </label>
                <span className="text-[11px] text-text-muted">Optional</span>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1">
                  Current Page
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 184"
                  value={bookPages}
                  onChange={(e) => setBookPages(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {/* 3. Star Rating (0.5 to 5.0 stars, normalized 0-100 internally) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <span>Star Rating</span>
                {starRating !== null && (
                  <span className="text-[11px] font-mono text-accent">
                    ({starRating.toFixed(1)} / 5)
                  </span>
                )}
              </label>
              {starRating !== null && (
                <button
                  type="button"
                  onClick={() => setStarRating(null)}
                  className="text-[11px] text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear rating
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-bg rounded-lg border border-border">
              {/* Interactive 5 Stars with half-star hover and click */}
              <div
                className="flex items-center gap-1.5"
                onMouseLeave={() => setHoverRating(null)}
              >
                {[1, 2, 3, 4, 5].map((starIndex) => {
                  const displayScore = hoverRating ?? starRating ?? 0;
                  const isFilled = displayScore >= starIndex;
                  const isHalf = displayScore >= starIndex - 0.5 && displayScore < starIndex;

                  return (
                    <div
                      key={starIndex}
                      className="relative cursor-pointer p-0.5 group"
                    >
                      {/* Left half clickable (for .5 rating) */}
                      <div
                        className="absolute inset-y-0 left-0 w-1/2 z-10"
                        onMouseEnter={() => setHoverRating(starIndex - 0.5)}
                        onClick={() => setStarRating(starIndex - 0.5)}
                      />
                      {/* Right half clickable (for full rating) */}
                      <div
                        className="absolute inset-y-0 right-0 w-1/2 z-10"
                        onMouseEnter={() => setHoverRating(starIndex)}
                        onClick={() => setStarRating(starIndex)}
                      />

                      <Star
                        className={`w-6 h-6 transition-transform duration-150 group-hover:scale-110 ${
                          isFilled
                            ? "text-amber-500 fill-amber-500"
                            : isHalf
                            ? "text-amber-500 fill-amber-500/50"
                            : "text-border fill-transparent"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Rating description score text */}
              <span className="text-xs font-medium text-text font-sans">
                {(hoverRating ?? starRating) !== null && (hoverRating ?? starRating)! > 0
                  ? RATING_LABELS[hoverRating ?? starRating!] ||
                    `${(hoverRating ?? starRating)!.toFixed(1)} / 5.0 Stars`
                  : "No rating set"}
              </span>
            </div>
          </div>

          {/* 3. Review Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text">
                Your Review / Notes
              </label>
              <span className="text-[11px] font-mono text-text-muted">
                {review.length} characters
              </span>
            </div>
            <textarea
              rows={4}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="What were your thoughts on this title? Favorite scenes, performances, morning reflections, or themes..."
              className="w-full p-3 rounded-lg bg-bg border border-border text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/25 resize-y transition-colors leading-relaxed shadow-2xs"
            />
          </div>

          {/* 4. Privacy Setting */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text">
              Log Privacy
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrivacy("public")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  privacy === "public"
                    ? "bg-accent/15 border-accent text-accent font-semibold"
                    : "bg-bg text-text-muted border-border hover:text-text"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Public</span>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy("friends")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  privacy === "friends"
                    ? "bg-accent/15 border-accent text-accent font-semibold"
                    : "bg-bg text-text-muted border-border hover:text-text"
                }`}
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>Friends</span>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy("private")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  privacy === "private"
                    ? "bg-accent/15 border-accent text-accent font-semibold"
                    : "bg-bg text-text-muted border-border hover:text-text"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Private</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-border gap-3">
            {existingEntry?.id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                isLoading={isDeleting}
                className="text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 gap-1.5"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Log
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                className="text-xs px-5 font-semibold"
              >
                {existingEntry?.id ? "Update Log" : "Save to Diary"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
