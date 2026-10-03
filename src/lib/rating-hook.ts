"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  RatingScale,
  normalizeRatingScale,
  getSavedRatingScale,
  setSavedRatingScale,
} from "./rating";

/**
 * React hook to retrieve and update the active rating scale.
 * Respects the authenticated user's profile (`rating_scale`),
 * falling back gracefully to local storage and emitting events
 * so all components re-render immediately upon change.
 */
export function useRatingScale(): {
  scale: RatingScale;
  setScale: (newScale: RatingScale) => Promise<void>;
} {
  const { profile, updateProfile } = useAuth();

  const [localOverride, setLocalOverride] = useState<RatingScale>(() => getSavedRatingScale());

  // Listen to cross-component changes
  useEffect(() => {
    const handleStorageOrEvent = () => {
      setLocalOverride(getSavedRatingScale());
    };
    window.addEventListener("rating-scale-changed", handleStorageOrEvent);
    return () => {
      window.removeEventListener("rating-scale-changed", handleStorageOrEvent);
    };
  }, []);

  const scale = profile?.rating_scale
    ? normalizeRatingScale(profile.rating_scale)
    : localOverride;

  const setScale = useCallback(
    async (newScale: RatingScale) => {
      setLocalOverride(newScale);
      setSavedRatingScale(newScale);

      try {
        await updateProfile({ rating_scale: newScale });
      } catch (err) {
        console.error("Failed to persist rating scale to profile:", err);
      }
    },
    [updateProfile]
  );

  return { scale, setScale };
}
