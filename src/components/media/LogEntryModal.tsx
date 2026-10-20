"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
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
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RatingInput } from "@/components/ui/RatingInput";
import { useAuth } from "@/context/AuthContext";
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

  // Stored rating is normalized 0-100 internally
  const [rating, setRating] = useState<number | null>(() => {
    if (existingEntry?.rating !== undefined && existingEntry.rating !== null) {
      const r = Number(existingEntry.rating);
      if (r > 0 && r <= 5) return Math.round(r * 20);
      return Math.min(100, Math.max(0, Math.round(r)));
    }
    return null;
  });

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

  const [review, setReview] = useState<string>(
    () => existingEntry?.review || (existingEntry as unknown as { notes?: string })?.notes || ""
  );
  const [containsSpoilers, setContainsSpoilers] = useState<boolean>(() => {
    const ex = existingEntry as Record<string, unknown> | null | undefined;
    const prog = existingProgress as Record<string, unknown> | null | undefined;
    return Boolean(ex?.contains_spoilers || prog?.contains_spoilers);
  });
  const { profile } = useAuth();
  const [privacy, setPrivacy] = useState<PrivacyLevel>(
    existingEntry?.privacy || profile?.default_privacy || "private"
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
      // 1. Rating is already normalized 0-100 internally
      const normalizedRating = rating;

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

      if (containsSpoilers) {
        progressPayload = progressPayload || {};
        progressPayload.contains_spoilers = true;
      }

      const payload = {
        media_id: media.id,
        media_type: media.type,
        status,
        rating: normalizedRating,
        progress: progressPayload,
        review: review.trim() || null,
        contains_spoilers: containsSpoilers,
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

      // Clear deprecated localStorage diary key to prevent stale cache
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("mediary_diary_entries");
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

      // Remove deprecated localStorage key
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("mediary_diary_entries");
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-text/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-6 border-b border-border bg-surface-hover/30 flex items-start justify-between gap-3 shrink-0">
          <div className="flex gap-3 items-center min-w-0">
            {/* Media thumbnail */}
            <div className="relative w-10 sm:w-12 h-14 sm:h-16 rounded-md overflow-hidden bg-bg border border-border shrink-0 shadow-2xs">
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

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-accent truncate">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">meDiary Journal Entry</span>
              </div>
              <h2
                id="log-entry-title"
                className="font-serif text-lg sm:text-2xl font-bold text-text leading-tight truncate"
              >
                {media.title}
              </h2>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-text-muted mt-0.5">
                <span className="capitalize">{media.type}</span>
                {releaseYear && <span>· {releaseYear}</span>}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 sm:p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto">
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

          {/* 3. Multi-Scale Rating Input (5-star, 10-point, 100-point, or thumbs) */}
          <RatingInput value={rating} onChange={setRating} />

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

            {/* Spoiler Tagging Checkbox */}
            <div className="pt-1.5">
              <label
                htmlFor="contains-spoilers-checkbox"
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer select-none group ${
                  containsSpoilers
                    ? "border-amber-500/40 bg-amber-500/10 text-text"
                    : "border-border bg-bg/60 hover:bg-bg text-text"
                }`}
              >
                <input
                  type="checkbox"
                  id="contains-spoilers-checkbox"
                  checked={containsSpoilers}
                  onChange={(e) => setContainsSpoilers(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent/30 accent-accent cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <EyeOff
                      className={`w-3.5 h-3.5 ${
                        containsSpoilers
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-text-muted group-hover:text-accent"
                      }`}
                    />
                    <span className={containsSpoilers ? "text-amber-700 dark:text-amber-300" : "text-text"}>
                      Contains Spoilers
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                    {containsSpoilers
                      ? "Review text will be safely blurred and hidden behind a 'Show spoilers' button for other readers."
                      : "Check this if your notes reveal plot twists, endings, or key story surprises."}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 4. Privacy Setting */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-text">
              Log Privacy
            </label>
            <div className="flex items-center gap-2">
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
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {privacy === "private" && "Only you"}
              {privacy === "friends" && "People you follow who follow you back"}
              {privacy === "public" && "Anyone, including visitors"}
            </p>
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
                className="text-red-600 dark:text-red-400 hover:bg-red-500/10"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
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
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
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
