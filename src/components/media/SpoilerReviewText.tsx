"use client";

import React, { useState } from "react";
import { EyeOff, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SpoilerReviewTextProps {
  text: string;
  containsSpoilers?: boolean;
  isAuthor?: boolean;
  defaultRevealed?: boolean;
  className?: string;
}

export function SpoilerReviewText({
  text,
  containsSpoilers = false,
  isAuthor = false,
  defaultRevealed = false,
  className = "",
}: SpoilerReviewTextProps) {
  // If user is author, they can view their own review without spoiler barrier by default,
  // but can toggle preview of how others see it.
  const [isRevealed, setIsRevealed] = useState<boolean>(defaultRevealed || isAuthor);

  if (!text) return null;

  // Plain review without spoiler tags
  if (!containsSpoilers) {
    return (
      <div className={`text-xs sm:text-sm text-text/90 font-sans leading-relaxed whitespace-pre-wrap ${className}`}>
        {text}
      </div>
    );
  }

  // Review contains spoilers
  return (
    <div className={`space-y-2.5 ${className}`}>
      {!isRevealed ? (
        /* Blurred / Hidden Spoiler Barrier */
        <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-4 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <EyeOff className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>Contains Spoilers</span>
                  {isAuthor && (
                    <span className="text-[10px] font-mono font-normal text-text-muted">
                      (Your review)
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-text-muted">
                  This review discusses plot details or endings.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsRevealed(true)}
              className="text-xs h-8 gap-1.5 shrink-0 bg-surface hover:bg-surface-hover border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-2xs font-medium cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show spoilers</span>
            </Button>
          </div>

          {/* Blurred background preview to give visual depth without leaking content */}
          <div
            aria-hidden="true"
            className="mt-3 text-xs sm:text-sm text-text/40 font-sans filter blur-[6px] select-none pointer-events-none line-clamp-2 leading-relaxed opacity-40"
          >
            {text}
          </div>
        </div>
      ) : (
        /* Revealed Review with Re-hide Controls */
        <div className="space-y-2 p-3.5 sm:p-4 rounded-xl border border-border/80 bg-surface/60 transition-all">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Spoiler content revealed</span>
            </span>

            <button
              type="button"
              onClick={() => setIsRevealed(false)}
              className="inline-flex items-center gap-1 text-text-muted hover:text-text hover:underline transition-colors cursor-pointer text-[11px]"
            >
              <EyeOff className="w-3 h-3" />
              <span>Hide spoilers</span>
            </button>
          </div>

          <div className="text-xs sm:text-sm text-text/90 font-sans leading-relaxed whitespace-pre-wrap pt-0.5">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
