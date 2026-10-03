"use client";

import React from "react";
import { Star, ThumbsUp, ThumbsDown, Sliders } from "lucide-react";
import { useRatingScale } from "@/lib/rating-hook";
import {
  RatingScale,
  formatRatingForDisplay,
} from "@/lib/rating";

interface RatingBadgeProps {
  rating: number | null | undefined;
  scale?: RatingScale;
  size?: "sm" | "md" | "lg";
  showDenominator?: boolean;
  className?: string;
  showEmpty?: boolean;
}

export function RatingBadge({
  rating,
  scale: scaleOverride,
  size = "md",
  showDenominator = true,
  className = "",
  showEmpty = false,
}: RatingBadgeProps) {
  const { scale: userScale } = useRatingScale();
  const activeScale = scaleOverride || userScale;

  const formatted = formatRatingForDisplay(rating, activeScale);

  if (!formatted.hasRating) {
    if (!showEmpty) return null;
    return (
      <span className={`text-text-muted text-xs ${className}`}>
        No rating
      </span>
    );
  }

  // Size configurations
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px] gap-1",
    md: "px-2 py-0.5 text-xs gap-1.5",
    lg: "px-2.5 py-1 text-sm gap-2 font-bold",
  }[size];

  const iconSizes = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }[size];

  if (activeScale === "thumbs") {
    const isUp = formatted.thumbsValue === "up";
    return (
      <div
        className={`inline-flex items-center rounded-md font-semibold font-sans shadow-2xs border transition-colors ${
          isUp
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
        } ${sizeClasses} ${className}`}
      >
        {isUp ? (
          <ThumbsUp className={`${iconSizes} fill-current`} />
        ) : (
          <ThumbsDown className={`${iconSizes} fill-current`} />
        )}
        <span>{formatted.displayText}</span>
      </div>
    );
  }

  if (activeScale === "100-point") {
    return (
      <div
        className={`inline-flex items-center rounded-md bg-accent/15 border border-accent/30 text-accent font-bold font-sans shadow-2xs ${sizeClasses} ${className}`}
      >
        <Sliders className={`${iconSizes} text-accent`} />
        <span>{formatted.numericValue}</span>
        {showDenominator && (
          <span className="text-text-muted font-normal text-[10px]">
            {formatted.scoreDenominator}
          </span>
        )}
      </div>
    );
  }

  if (activeScale === "10-point") {
    return (
      <div
        className={`inline-flex items-center rounded-md bg-accent/15 border border-accent/30 text-accent font-bold font-sans shadow-2xs ${sizeClasses} ${className}`}
      >
        <Star className={`${iconSizes} fill-accent text-accent`} />
        <span>{formatted.numericValue?.toFixed(1)}</span>
        {showDenominator && (
          <span className="text-text-muted font-normal text-[10px]">
            {formatted.scoreDenominator}
          </span>
        )}
      </div>
    );
  }

  // 5-Star Default
  return (
    <div
      className={`inline-flex items-center rounded-md bg-accent/15 border border-accent/30 text-accent font-bold font-sans shadow-2xs ${sizeClasses} ${className}`}
    >
      <Star className={`${iconSizes} fill-accent text-accent`} />
      <span>{formatted.numericValue?.toFixed(1)}</span>
      {showDenominator && (
        <span className="text-text-muted font-normal text-[10px]">
          {formatted.scoreDenominator}
        </span>
      )}
    </div>
  );
}
