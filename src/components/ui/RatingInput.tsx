"use client";

import React, { useState } from "react";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  X,
  ChevronDown,
} from "lucide-react";
import {
  RatingScale,
  RATING_SCALE_CONFIG,
  storedRatingToStars,
  starsToStoredRating,
  storedRatingTo10Point,
  tenPointToStoredRating,
  storedRatingTo100Point,
  hundredPointToStoredRating,
  storedRatingToThumbs,
  thumbsToStoredRating,
} from "@/lib/rating";
import { useRatingScale } from "@/lib/rating-hook";

interface RatingInputProps {
  value: number | null | undefined; // Normalized 0-100 internally
  onChange: (normalizedValue: number | null) => void;
  scale?: RatingScale;
  allowScaleSwitch?: boolean;
}

const FIVE_STAR_LABELS: Record<number, string> = {
  0.5: "0.5 · Appalling",
  1.0: "1.0 · Terrible",
  1.5: "1.5 · Poor",
  2.0: "2.0 · Mediocre",
  2.5: "2.5 · Average",
  3.0: "3.0 · Decent",
  3.5: "3.5 · Good",
  4.0: "4.0 · Great",
  4.5: "4.5 · Exceptional",
  5.0: "5.0 · Masterpiece",
};

const TEN_POINT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HUNDRED_POINT_PRESETS = [50, 60, 70, 75, 80, 85, 90, 95, 100];

export function RatingInput({
  value,
  onChange,
  scale: scaleOverride,
  allowScaleSwitch = true,
}: RatingInputProps) {
  const { scale: userScale, setScale: setUserScale } = useRatingScale();
  const activeScale = scaleOverride || userScale;

  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [showScaleMenu, setShowScaleMenu] = useState(false);

  const handleScaleSelect = async (newScale: RatingScale) => {
    setShowScaleMenu(false);
    await setUserScale(newScale);
  };

  // Convert current 0-100 value to active scale representations
  const currentStars = storedRatingToStars(value);
  const currentTenPoint = storedRatingTo10Point(value);
  const currentHundredPoint = storedRatingTo100Point(value);
  const currentThumbs = storedRatingToThumbs(value);

  const hasRating = value !== null && value !== undefined && value > 0;

  return (
    <div className="space-y-3">
      {/* Header bar: Label, Clear button, and Scale Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
            <span>Rating</span>
          </label>

          {/* Quick Scale Selector Dropdown */}
          {allowScaleSwitch && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowScaleMenu(!showScaleMenu)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium text-text-muted hover:text-text bg-surface-elevated/70 border border-border/80 hover:border-accent/40 transition-colors cursor-pointer"
                title="Change active rating scale"
              >
                <span>{RATING_SCALE_CONFIG[activeScale].name}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showScaleMenu && (
                <div className="absolute left-0 mt-1 w-52 rounded-lg bg-surface border border-border shadow-lg py-1.5 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-text-muted border-b border-border/60">
                    Switch Rating Scale
                  </div>
                  {(["5-star", "10-point", "100-point", "thumbs"] as RatingScale[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleScaleSelect(s)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-surface-hover cursor-pointer transition-colors ${
                        activeScale === s ? "text-accent font-semibold bg-accent/5" : "text-text"
                      }`}
                    >
                      <span>{RATING_SCALE_CONFIG[s].name}</span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {RATING_SCALE_CONFIG[s].example}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {hasRating && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-text-muted hover:text-red-500 transition-colors cursor-pointer flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>Clear rating</span>
          </button>
        )}
      </div>

      {/* Scale Input Body */}
      <div className="p-3 bg-bg rounded-lg border border-border space-y-3">
        {/* ============================================================== */}
        {/* 1. 5-STAR SCALE */}
        {/* ============================================================== */}
        {activeScale === "5-star" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              className="flex items-center gap-1.5"
              onMouseLeave={() => setHoverRating(null)}
            >
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const displayScore = hoverRating ?? currentStars ?? 0;
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
                      onClick={() => onChange(starsToStoredRating(starIndex - 0.5))}
                    />
                    {/* Right half clickable (for full rating) */}
                    <div
                      className="absolute inset-y-0 right-0 w-1/2 z-10"
                      onMouseEnter={() => setHoverRating(starIndex)}
                      onClick={() => onChange(starsToStoredRating(starIndex))}
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

            <span className="text-xs font-medium text-text font-sans">
              {(hoverRating ?? currentStars) !== null && (hoverRating ?? currentStars)! > 0
                ? FIVE_STAR_LABELS[hoverRating ?? currentStars!] ||
                  `${(hoverRating ?? currentStars)!.toFixed(1)} / 5.0 Stars`
                : "No rating set"}
            </span>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. 10-POINT SCALE */}
        {/* ============================================================== */}
        {activeScale === "10-point" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-sans">
                Select score (1 to 10)
              </span>
              <span className="text-sm font-bold text-accent font-mono">
                {currentTenPoint !== null ? `${currentTenPoint.toFixed(1)} / 10` : "No rating"}
              </span>
            </div>

            {/* Segmented Preset Chips */}
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
              {TEN_POINT_PRESETS.map((pt) => {
                const isSelected =
                  currentTenPoint !== null && Math.round(currentTenPoint) === pt;

                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => onChange(tenPointToStoredRating(pt))}
                    className={`h-8 sm:h-9 rounded font-mono font-bold text-xs transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? "bg-accent text-accent-contrast shadow-2xs scale-105"
                        : "bg-surface border border-border/80 text-text-muted hover:text-text hover:border-accent/50"
                    }`}
                  >
                    {pt}
                  </button>
                );
              })}
            </div>

            {/* Stepper for Half-Points */}
            {currentTenPoint !== null && (
              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                <span className="text-text-muted text-[11px]">Fine-tune score:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        tenPointToStoredRating(Math.max(1, currentTenPoint - 0.5))
                      )
                    }
                    className="px-2 py-0.5 rounded bg-surface border border-border text-xs hover:border-accent cursor-pointer"
                  >
                    - 0.5
                  </button>
                  <span className="font-mono font-semibold text-text">
                    {currentTenPoint.toFixed(1)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        tenPointToStoredRating(Math.min(10, currentTenPoint + 0.5))
                      )
                    }
                    className="px-2 py-0.5 rounded bg-surface border border-border text-xs hover:border-accent cursor-pointer"
                  >
                    + 0.5
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. 100-POINT SCALE */}
        {/* ============================================================== */}
        {activeScale === "100-point" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-muted font-sans">
                Percentage / 100-point score
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={currentHundredPoint !== null ? currentHundredPoint : ""}
                  placeholder="0-100"
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : Number(e.target.value);
                    if (val === null) onChange(null);
                    else onChange(hundredPointToStoredRating(Math.min(100, Math.max(0, val))));
                  }}
                  className="w-16 h-7 px-2 text-center text-xs font-mono font-bold rounded bg-surface border border-border text-text focus:outline-hidden focus:border-accent"
                />
                <span className="text-xs font-mono text-text-muted">/ 100</span>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={currentHundredPoint ?? 0}
              onChange={(e) => onChange(hundredPointToStoredRating(Number(e.target.value)))}
              className="w-full accent-accent h-2 bg-surface rounded-lg cursor-pointer"
            />

            {/* Quick score presets */}
            <div className="flex flex-wrap gap-1 pt-1 justify-between">
              {HUNDRED_POINT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(hundredPointToStoredRating(preset))}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    currentHundredPoint === preset
                      ? "bg-accent text-accent-contrast font-bold shadow-2xs"
                      : "bg-surface border border-border/80 text-text-muted hover:text-text hover:border-accent"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. THUMBS UP / DOWN SCALE */}
        {/* ============================================================== */}
        {activeScale === "thumbs" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange(thumbsToStoredRating("up"))}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-3 ${
                currentThumbs === "up"
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs"
                  : "border-border bg-surface hover:border-emerald-500/40 text-text-muted hover:text-text"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center ${
                  currentThumbs === "up"
                    ? "bg-emerald-500 text-white"
                    : "bg-surface-elevated text-emerald-600 dark:text-emerald-400"
                }`}
              >
                <ThumbsUp className="w-5 h-5 fill-current" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold">Thumbs Up</span>
                <span className="text-[10px] opacity-75 font-normal">Recommend</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChange(thumbsToStoredRating("down"))}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-3 ${
                currentThumbs === "down"
                  ? "border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300 font-bold shadow-xs"
                  : "border-border bg-surface hover:border-rose-500/40 text-text-muted hover:text-text"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center ${
                  currentThumbs === "down"
                    ? "bg-rose-500 text-white"
                    : "bg-surface-elevated text-rose-600 dark:text-rose-400"
                }`}
              >
                <ThumbsDown className="w-5 h-5 fill-current" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold">Thumbs Down</span>
                <span className="text-[10px] opacity-75 font-normal">Don&apos;t recommend</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
