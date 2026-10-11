"use client";

import React, { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SOCIAL_ALLOWED_MEDIA_TYPES } from "@/lib/social";

interface LikeButtonProps {
  entryId?: string;
  listId?: string;
  mediaType?: string;
  initialCount?: number;
  initialIsLiked?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function LikeButton({
  entryId,
  listId,
  mediaType,
  initialCount = 0,
  initialIsLiked = false,
  size = "sm",
  className = "",
}: LikeButtonProps) {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(initialCount);
  const [isLiked, setIsLiked] = useState<boolean>(initialIsLiked);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If entryId is provided and mediaType is known, check if allowed
  const isMediaTypeAllowed =
    !entryId ||
    !mediaType ||
    SOCIAL_ALLOWED_MEDIA_TYPES.includes(mediaType as "movie" | "tv");

  // Fetch initial like count and status if not provided or to ensure fresh state
  useEffect(() => {
    let ignore = false;
    async function fetchStatus() {
      if (!entryId && !listId) return;
      if (!isMediaTypeAllowed) return;

      try {
        const query = entryId ? `entry_id=${entryId}` : `list_id=${listId}`;
        const res = await fetch(`/api/likes?${query}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setCount(data.count ?? 0);
            setIsLiked(Boolean(data.isLiked));
          }
        }
      } catch {
        // ignore background refresh errors
      }
    }

    fetchStatus();
    return () => {
      ignore = true;
    };
  }, [entryId, listId, isMediaTypeAllowed]);

  if (!isMediaTypeAllowed) {
    return null;
  }

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setErrorMessage("Please sign in to like");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (isLoading) return;

    // Optimistic Update
    const prevLiked = isLiked;
    const prevCount = count;
    const newLiked = !prevLiked;
    const newCount = newLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    setIsLiked(newLiked);
    setCount(newCount);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (newLiked) {
        // POST
        const res = await fetch("/api/likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entry_id: entryId || undefined,
            list_id: listId || undefined,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to like");
        }

        const data = await res.json();
        setCount(data.count ?? newCount);
      } else {
        // DELETE
        const query = entryId ? `entry_id=${entryId}` : `list_id=${listId}`;
        const res = await fetch(`/api/likes?${query}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to unlike");
        }

        const data = await res.json();
        setCount(data.count ?? newCount);
      }
    } catch (err) {
      // Revert optimistic update on error
      setIsLiked(prevLiked);
      setCount(prevCount);
      const msg = err instanceof Error ? err.message : "Failed to update like";
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const isSmall = size === "sm";

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleToggleLike}
        disabled={isLoading}
        aria-label={isLiked ? "Unlike" : "Like"}
        title={isLiked ? "Unlike" : "Like"}
        className={`group inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer select-none active:scale-95 ${
          isLiked
            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold"
            : "bg-surface border-border/80 text-text-muted hover:text-text hover:border-border hover:bg-surface-raised"
        } ${isSmall ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${className}`}
      >
        <Heart
          className={`${isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} transition-transform group-hover:scale-110 ${
            isLiked ? "fill-rose-500 text-rose-500" : "fill-transparent"
          }`}
        />
        <span className="font-mono text-xs tabular-nums font-medium">
          {count > 0 ? count : ""}
        </span>
      </button>

      {/* Floating friendly error alert tooltip */}
      {errorMessage && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 px-2.5 py-1 rounded-md bg-stone-900 text-white text-[11px] whitespace-nowrap shadow-md animate-in fade-in zoom-in-95 pointer-events-none">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
