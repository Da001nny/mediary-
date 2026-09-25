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
  const [rating, setRating] = useState<number | null>(
    existingEntry?.rating ?? null
  );
  const [hoverRating, setHoverRating] = useState<number | null>(null);
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
      const payload = {
        media_id: media.id,
        title: media.title,
        media_type: media.type,
        cover_url: media.cover_url,
        status,
        rating,
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
            rating: rating ? Math.round(rating * 20) : null, // Convert 5-star to 100-pt scale for diary view
            star_rating: rating,
            notes: review.trim() || null,
            privacy,
            logged_at: new Date().toISOString(),
          };

          const filtered = localEntries.filter(
            (e: { media_id: string }) => e.media_id !== media.id
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

          {/* 2. Star Rating (0.5 to 5.0 stars) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text">
                Star Rating
              </label>
              {rating !== null && (
                <button
                  type="button"
                  onClick={() => setRating(null)}
                  className="text-[11px] text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear rating
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-bg rounded-lg border border-border">
              {/* Interactive 5 Stars with hover */}
              <div
                className="flex items-center gap-1.5"
                onMouseLeave={() => setHoverRating(null)}
              >
                {[1, 2, 3, 4, 5].map((starIndex) => {
                  const displayScore = hoverRating ?? rating ?? 0;
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
                        onClick={() => setRating(starIndex - 0.5)}
                      />
                      {/* Right half clickable (for full rating) */}
                      <div
                        className="absolute inset-y-0 right-0 w-1/2 z-10"
                        onMouseEnter={() => setHoverRating(starIndex)}
                        onClick={() => setRating(starIndex)}
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
                {(hoverRating ?? rating) !== null && (hoverRating ?? rating)! > 0
                  ? RATING_LABELS[hoverRating ?? rating!] ||
                    `${(hoverRating ?? rating)!.toFixed(1)} / 5.0`
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
