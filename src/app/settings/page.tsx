"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Star,
  Sliders,
  ThumbsUp,
  Globe,
  Users,
  Lock,
  Check,
  Loader2,
  Info,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { useAuth } from "@/context/AuthContext";
import { useRatingScale } from "@/lib/rating-hook";
import {
  RatingScale,
  RATING_SCALE_CONFIG,
  normalizeRatingScale,
} from "@/lib/rating";
import { AlgoliaStatusCard } from "@/components/settings/AlgoliaStatusCard";
import type { PrivacyLevel } from "@/types/database.types";

export default function SettingsPage() {
  const { profile, updateProfile, user } = useAuth();
  const { scale: currentScale, setScale } = useRatingScale();

  // Read current scale from profiles.rating_scale on load; fallback to currentScale
  const profileScale: RatingScale = profile?.rating_scale
    ? normalizeRatingScale(profile.rating_scale)
    : currentScale;

  const [overrideScale, setOverrideScale] = useState<RatingScale | null>(null);
  const activeScale = overrideScale ?? profileScale;

  const [savingScale, setSavingScale] = useState<RatingScale | null>(null);

  const [displayNameInput, setDisplayNameInput] = useState<string | null>(null);
  const [bioInput, setBioInput] = useState<string | null>(null);
  const [privacyInput, setPrivacyInput] = useState<PrivacyLevel | null>(null);

  const displayName = displayNameInput ?? (profile?.display_name || user?.user_metadata?.full_name || "");
  const bio = bioInput ?? (profile?.bio || "");
  const defaultPrivacy = privacyInput ?? (profile?.default_privacy || "public");

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Directly update profiles.rating_scale when user selects any option
  const handleSelectScale = async (scaleOption: RatingScale) => {
    setOverrideScale(scaleOption);
    setSavingScale(scaleOption);
    setError(null);
    setSuccessMessage(null);

    try {
      // 1. Immediately update global hook & localStorage
      await setScale(scaleOption);

      // 2. Immediately call update to profiles.rating_scale in database & profile state
      const res = await updateProfile({ rating_scale: scaleOption });
      if (res?.error) {
        console.warn("Could not save to remote profile, saved locally:", res.error);
      }

      setSuccessMessage(`Rating scale set to ${RATING_SCALE_CONFIG[scaleOption].name}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update rating scale"
      );
    } finally {
      setSavingScale(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await setScale(activeScale);

      const updates = {
        rating_scale: activeScale,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        default_privacy: defaultPrivacy,
      };

      const res = await updateProfile(updates);
      if (res?.error) {
        throw res.error;
      }

      setSuccessMessage("All settings saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getScaleIcon = (scaleId: RatingScale) => {
    switch (scaleId) {
      case "5-star":
        return <Star className="w-4 h-4 text-amber-500 fill-amber-500" />;
      case "10-point":
        return <Star className="w-4 h-4 text-accent fill-accent" />;
      case "100-point":
        return <Sliders className="w-4 h-4 text-accent" />;
      case "thumbs":
        return <ThumbsUp className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />;
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-16 space-y-12 sm:space-y-14">
        {/* Breadcrumb / Return */}
        <div>
          <Link
            href="/diary"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-accent transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Return to Media Journal</span>
          </Link>
        </div>

        {/* Page Title */}
        <div className="border-b border-border/80 pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-bold font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>User Preferences</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-text tracking-tight">
            Profile & Journal Settings
          </h1>
          <p className="text-sm sm:text-base text-text-muted font-sans max-w-2xl leading-relaxed">
            Customize your rating scale format, journal privacy defaults, and catalog synchronization.
          </p>
        </div>

        {error && (
          <div className="p-4 text-xs sm:text-sm rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 text-xs sm:text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-10 sm:space-y-12">
          {/* Card: Rating Scale */}
          <div className="p-7 sm:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-5">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
                  Rating Scale
                </h2>
                <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                  Select your preferred evaluation format. All ratings are stored as 0–100 internally and seamlessly convert between scales.
                </p>
              </div>
              <Badge variant="amber" size="sm" className="font-mono text-xs self-start sm:self-auto py-1 px-2.5">
                Normalized 0–100 Engine
              </Badge>
            </div>

            {/* 4 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {(["5-star", "10-point", "100-point", "thumbs"] as RatingScale[]).map(
                (scaleOption) => {
                  const isSelected = activeScale === scaleOption;
                  const isSavingThis = savingScale === scaleOption;
                  const config = RATING_SCALE_CONFIG[scaleOption];

                  return (
                    <button
                      key={scaleOption}
                      type="button"
                      onClick={() => handleSelectScale(scaleOption)}
                      className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 card-depth-hover ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent"
                          : "border-border/80 bg-bg/50 hover:bg-surface-hover hover:border-text/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center border border-border/80 shadow-2xs">
                            {getScaleIcon(scaleOption)}
                          </div>
                          <div>
                            <span className="font-serif text-base sm:text-lg font-bold text-text block">
                              {config.name}
                            </span>
                            <span className="text-xs font-mono text-text-muted">
                              {config.example}
                            </span>
                          </div>
                        </div>
                        {isSavingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        ) : isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-text-muted leading-relaxed">
                        {config.description}
                      </p>

                      {/* Live preview */}
                      <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                        <span className="text-text-muted text-[11px] uppercase font-mono font-semibold">
                          Live Sample:
                        </span>
                        <RatingBadge rating={85} scale={scaleOption} size="sm" />
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border/70 flex items-start gap-3 text-xs text-text-muted">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-text font-semibold">Cross-Scale Preservation:</strong> If you switch from 5-Star (e.g. 4.0 ★) to 100-Point, your score displays as 80 / 100. Switching to Thumbs Up/Down displays as 👍 Liked. Your diary entries and reviews adapt everywhere.
              </p>
            </div>
          </div>

          {/* Card: Profile Defaults */}
          <div className="p-7 sm:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-6">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text border-b border-border/70 pb-4">
              Journal Byline & Privacy
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your Name"
                  className="w-full h-11 px-4 text-sm rounded-xl bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-all shadow-2xs"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                  Bio / Journal Intro
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Short tagline about your media taste"
                  className="w-full h-11 px-4 text-sm rounded-xl bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                Default Entry Privacy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {[
                  { id: "public", label: "Public", desc: "Visible to all", icon: Globe },
                  { id: "friends", label: "Friends", desc: "Shared only", icon: Users },
                  { id: "private", label: "Private", desc: "Only you", icon: Lock },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = defaultPrivacy === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPrivacyInput(item.id as PrivacyLevel)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                          : "border-border/80 bg-bg/50 hover:bg-surface-hover text-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-accent" : ""}`} />
                        <span className="text-sm font-bold text-text">{item.label}</span>
                      </div>
                      <span className="text-xs text-text-muted">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card: Algolia Search & Catalog Indexing */}
          <AlgoliaStatusCard />

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/diary">
              <Button type="button" variant="secondary" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
              className="gap-2 font-semibold shadow-xs"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Save All Settings</span>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
