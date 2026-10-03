/**
 * Rating Scale Configuration & Conversion System
 *
 * All ratings are normalized and stored internally as an integer between 0 and 100 (or null).
 * Supported user-facing rating scales:
 *  - '5-star'    : 0.5 to 5.0 stars (step 0.5)
 *  - '10-point'  : 1.0 to 10.0 points (step 0.1 to 0.5)
 *  - '100-point' : 0 to 100 points (step 1)
 *  - 'thumbs'    : Binary thumbs up / thumbs down (thumbs up = 100, thumbs down = 25)
 */

export type RatingScale = "5-star" | "10-point" | "100-point" | "thumbs";

export const RATING_SCALE_STORAGE_KEY = "mediary_user_rating_scale";

/**
 * Normalizes any string representation (including legacy or alternate names)
 * to one of the 4 canonical RatingScale types.
 */
export function normalizeRatingScale(raw: string | null | undefined): RatingScale {
  if (!raw) return "5-star";
  const s = raw.toLowerCase().trim();
  if (s === "10" || s === "10-point" || s === "10_point" || s === "ten_point") {
    return "10-point";
  }
  if (s === "100" || s === "100-point" || s === "100_point" || s === "hundred_point") {
    return "100-point";
  }
  if (
    s === "thumbs" ||
    s === "thumbs_up_down" ||
    s === "thumbs-up-down" ||
    s === "binary"
  ) {
    return "thumbs";
  }
  // Default to 5-star
  return "5-star";
}

/**
 * Human-readable metadata for each rating scale.
 */
export const RATING_SCALE_CONFIG: Record<
  RatingScale,
  {
    id: RatingScale;
    name: string;
    description: string;
    example: string;
    step: number;
    min: number;
    max: number;
  }
> = {
  "5-star": {
    id: "5-star",
    name: "5-Star Scale",
    description: "Traditional 0.5 to 5.0 stars with half-star increments.",
    example: "★ 4.5 / 5",
    step: 0.5,
    min: 0.5,
    max: 5.0,
  },
  "10-point": {
    id: "10-point",
    name: "10-Point Scale",
    description: "Decimal 1.0 to 10.0 scale for nuanced ratings.",
    example: "8.5 / 10",
    step: 0.5,
    min: 1.0,
    max: 10.0,
  },
  "100-point": {
    id: "100-point",
    name: "100-Point Scale",
    description: "Granular 0 to 100 percentage scale for exact evaluation.",
    example: "85 / 100",
    step: 1,
    min: 0,
    max: 100,
  },
  thumbs: {
    id: "thumbs",
    name: "Thumbs Up / Down",
    description: "Simple binary recommendation (Liked or Disliked).",
    example: "👍 Liked",
    step: 1,
    min: 0,
    max: 1,
  },
};

// =========================================================================
// 1. Stored (0-100) -> Scale Conversion Helpers
// =========================================================================

/**
 * Converts a stored 0-100 rating to 5-star value (0.5 - 5.0).
 */
export function storedRatingToStars(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined || isNaN(Number(stored))) return null;
  const num = Number(stored);
  if (num <= 0) return null;

  // Legacy fallback: if stored value is <= 5 and not 0, assume it was legacy stars
  if (num <= 5) {
    return Math.round(num * 2) / 2;
  }

  const stars = Math.round((num / 20) * 2) / 2;
  return Math.min(5, Math.max(0.5, stars));
}

/**
 * Converts a stored 0-100 rating to 10-point value (1.0 - 10.0, step 0.5 or 0.1).
 */
export function storedRatingTo10Point(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined || isNaN(Number(stored))) return null;
  const num = Number(stored);
  if (num <= 0) return null;

  // Legacy fallback: if stored value is <= 5, map to 10-scale
  if (num <= 5) {
    return Math.min(10, Math.max(1, Math.round(num * 2 * 10) / 10));
  }

  // e.g. 85 / 10 = 8.5
  const pts = Math.round((num / 10) * 10) / 10;
  return Math.min(10, Math.max(1, pts));
}

/**
 * Converts a stored 0-100 rating to 100-point integer.
 */
export function storedRatingTo100Point(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined || isNaN(Number(stored))) return null;
  const num = Math.round(Number(stored));
  if (num <= 0) return null;
  // Legacy fallback
  if (num <= 5) {
    return Math.min(100, Math.max(0, num * 20));
  }
  return Math.min(100, Math.max(0, num));
}

/**
 * Converts a stored 0-100 rating to binary thumbs ('up' | 'down').
 * Rating >= 60 is considered Thumbs Up; < 60 is Thumbs Down.
 */
export function storedRatingToThumbs(
  stored: number | null | undefined
): "up" | "down" | null {
  if (stored === null || stored === undefined || isNaN(Number(stored))) return null;
  const num = Number(stored);
  if (num <= 0) return null;

  // Legacy check: <= 5
  if (num <= 5) {
    return num >= 3 ? "up" : "down";
  }

  return num >= 60 ? "up" : "down";
}

// =========================================================================
// 2. Scale Value -> Stored (0-100) Normalized Conversion Helpers
// =========================================================================

/**
 * Converts 5-star rating (0.5 - 5.0) to normalized 0-100 integer.
 */
export function starsToStoredRating(stars: number | null | undefined): number | null {
  if (stars === null || stars === undefined || isNaN(Number(stars))) return null;
  const num = Number(stars);
  if (num <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(num * 20)));
}

/**
 * Converts 10-point rating (1.0 - 10.0) to normalized 0-100 integer.
 */
export function tenPointToStoredRating(pts: number | null | undefined): number | null {
  if (pts === null || pts === undefined || isNaN(Number(pts))) return null;
  const num = Number(pts);
  if (num <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(num * 10)));
}

/**
 * Converts 100-point rating (0 - 100) to normalized 0-100 integer.
 */
export function hundredPointToStoredRating(
  score: number | null | undefined
): number | null {
  if (score === null || score === undefined || isNaN(Number(score))) return null;
  const num = Math.round(Number(score));
  if (num < 0) return null;
  return Math.min(100, Math.max(0, num));
}

/**
 * Converts thumbs ('up' | 'down') to normalized 0-100 integer.
 * Thumbs Up = 100, Thumbs Down = 25.
 */
export function thumbsToStoredRating(
  val: "up" | "down" | null | undefined
): number | null {
  if (!val) return null;
  return val === "up" ? 100 : 25;
}

/**
 * Unified converter from any scale value to normalized 0-100 stored rating.
 */
export function scaleValueToStored(
  value: number | "up" | "down" | null | undefined,
  scale: RatingScale
): number | null {
  if (value === null || value === undefined) return null;

  switch (scale) {
    case "5-star":
      return typeof value === "number" ? starsToStoredRating(value) : null;
    case "10-point":
      return typeof value === "number" ? tenPointToStoredRating(value) : null;
    case "100-point":
      return typeof value === "number" ? hundredPointToStoredRating(value) : null;
    case "thumbs":
      return typeof value === "string" ? thumbsToStoredRating(value as "up" | "down") : null;
  }
}

/**
 * Unified converter from stored 0-100 rating to scale value.
 */
export function storedToScaleValue(
  stored: number | null | undefined,
  scale: RatingScale
): number | "up" | "down" | null {
  if (stored === null || stored === undefined) return null;

  switch (scale) {
    case "5-star":
      return storedRatingToStars(stored);
    case "10-point":
      return storedRatingTo10Point(stored);
    case "100-point":
      return storedRatingTo100Point(stored);
    case "thumbs":
      return storedRatingToThumbs(stored);
  }
}

// =========================================================================
// 3. Formatted Display Helper
// =========================================================================

export interface FormattedRating {
  scale: RatingScale;
  hasRating: boolean;
  displayText: string;
  shortText: string;
  numericValue?: number;
  thumbsValue?: "up" | "down";
  scoreDenominator?: string;
}

/**
 * Formats a stored rating according to the user's selected scale.
 */
export function formatRatingForDisplay(
  stored: number | null | undefined,
  scale: RatingScale
): FormattedRating {
  if (stored === null || stored === undefined || isNaN(Number(stored)) || Number(stored) <= 0) {
    return {
      scale,
      hasRating: false,
      displayText: "No rating",
      shortText: "—",
    };
  }

  switch (scale) {
    case "5-star": {
      const stars = storedRatingToStars(stored) ?? 0;
      return {
        scale: "5-star",
        hasRating: true,
        displayText: `${stars.toFixed(1)} / 5`,
        shortText: `${stars.toFixed(1)} ★`,
        numericValue: stars,
        scoreDenominator: "/ 5",
      };
    }
    case "10-point": {
      const pts = storedRatingTo10Point(stored) ?? 0;
      const formatted = pts % 1 === 0 ? pts.toFixed(0) : pts.toFixed(1);
      return {
        scale: "10-point",
        hasRating: true,
        displayText: `${formatted} / 10`,
        shortText: `${formatted}/10`,
        numericValue: pts,
        scoreDenominator: "/ 10",
      };
    }
    case "100-point": {
      const pts = storedRatingTo100Point(stored) ?? 0;
      return {
        scale: "100-point",
        hasRating: true,
        displayText: `${pts} / 100`,
        shortText: `${pts}/100`,
        numericValue: pts,
        scoreDenominator: "/ 100",
      };
    }
    case "thumbs": {
      const thumb = storedRatingToThumbs(stored);
      const isUp = thumb === "up";
      return {
        scale: "thumbs",
        hasRating: true,
        displayText: isUp ? "Liked" : "Disliked",
        shortText: isUp ? "👍" : "👎",
        thumbsValue: thumb || "up",
      };
    }
  }
}

/**
 * Helper to get user's active rating scale from localStorage when not signed in or prior to sync.
 */
export function getSavedRatingScale(): RatingScale {
  if (typeof window === "undefined") return "5-star";
  try {
    const stored = localStorage.getItem(RATING_SCALE_STORAGE_KEY);
    if (stored) {
      return normalizeRatingScale(stored);
    }
  } catch {
    // Ignore error
  }
  return "5-star";
}

/**
 * Helper to save user's rating scale to localStorage.
 */
export function setSavedRatingScale(scale: RatingScale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RATING_SCALE_STORAGE_KEY, scale);
    window.dispatchEvent(new Event("rating-scale-changed"));
  } catch {
    // Ignore error
  }
}
