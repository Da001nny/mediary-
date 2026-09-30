/**
 * Utility functions to convert between UI 5-star rating (0.5 to 5.0 with half-star steps)
 * and the database's normalized 0-100 scale (e.g. 3.5 stars = 70).
 */

export function storedRatingToStars(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined || isNaN(Number(stored))) return null;
  const num = Number(stored);
  if (num <= 0) return null;

  // Gracefully handle any legacy unmigrated 0-5 values:
  // Since 0.5 stars is stored as 10 on the 0-100 scale, values <= 5 that are not 0
  // could only be legacy 0.5-5.0 entries.
  if (num <= 5) {
    return Math.round(num * 2) / 2;
  }

  // Normalized 0-100 scale: e.g. 70 / 20 = 3.5 stars
  const stars = Math.round((num / 20) * 2) / 2;
  return Math.min(5, Math.max(0.5, stars));
}

export function starsToStoredRating(stars: number | null | undefined): number | null {
  if (stars === null || stars === undefined || isNaN(Number(stars))) return null;
  const num = Number(stars);
  if (num <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(num * 20)));
}
