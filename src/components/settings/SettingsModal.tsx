"use client";

import React, { useState } from "react";
import {
  X,
  Settings,
  Star,
  Sliders,
  ThumbsUp,
  Globe,
  Users,
  Lock,
  Check,
  Loader2,
  Info,
} from "lucide-react";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import type { PrivacyLevel, ProfileVisibility } from "@/types/database.types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { scale } = useRatingScale();
  if (!isOpen) return null;

  return <SettingsModalContent key={scale} onClose={onClose} />;
}

function SettingsModalContent({ onClose }: { onClose: () => void }) {
  const { profile, updateProfile, user } = useAuth();
  const { scale: currentScale, setScale } = useRatingScale();

  const profileScale: RatingScale = profile?.rating_scale
    ? normalizeRatingScale(profile.rating_scale)
    : currentScale;

  const [overrideScale, setOverrideScale] = useState<RatingScale | null>(null);
  const activeScale = overrideScale ?? profileScale;

  const [savingScale, setSavingScale] = useState<RatingScale | null>(null);

  const [displayNameInput, setDisplayNameInput] = useState<string | null>(null);
  const [bioInput, setBioInput] = useState<string | null>(null);
  const [privacyInput, setPrivacyInput] = useState<PrivacyLevel | null>(null);
  const [visibilityInput, setVisibilityInput] = useState<ProfileVisibility | null>(null);

  const displayName = displayNameInput ?? (profile?.display_name || user?.user_metadata?.full_name || "");
  const bio = bioInput ?? (profile?.bio || "");
  const defaultPrivacy = privacyInput ?? (profile?.default_privacy || "public");
  const profileVisibility: ProfileVisibility =
    visibilityInput ??
    profile?.profile_visibility ??
    (profile?.default_privacy === "private" ? "private" : "public");

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
      // 1. Update global hook & localStorage
      await setScale(scaleOption);

      // 2. Call update to profiles.rating_scale in database & profile state
      const res = await updateProfile({ rating_scale: scaleOption });
      if (res?.error) {
        console.warn("Could not save to remote profile, saved locally:", res.error);
      }

      setSuccessMessage(`Rating scale set to ${RATING_SCALE_CONFIG[scaleOption].name}!`);
      setTimeout(() => setSuccessMessage(null), 2500);
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
      // 1. Update rating scale preference immediately
      await setScale(activeScale);

      // 2. Update user profile
      const updates = {
        rating_scale: activeScale,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        default_privacy: defaultPrivacy,
        profile_visibility: profileVisibility,
      };

      const res = await updateProfile(updates);
      if (res?.error) {
        throw res.error;
      }

      setSuccessMessage("Settings updated successfully!");
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center justify-between bg-surface-elevated/40">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="settings-modal-title" className="font-serif text-sm sm:text-lg font-bold text-text truncate">
                Profile & Journal Preferences
              </h2>
              <p className="text-[10px] sm:text-xs text-text-muted truncate">
                Configure your rating scale and journal defaults.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section 1: Rating Scale (Primary User Request) */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text">
                  Rating Scale
                </label>
                <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 leading-relaxed">
                  Choose how ratings are entered and displayed across all journal entries, title pages, and feeds.
                </p>
              </div>
              <Badge variant="amber" size="sm" className="font-mono text-[10px] self-start sm:self-auto shrink-0">
                Stored as 0-100 internally
              </Badge>
            </div>

            {/* 4 Scale Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent"
                          : "border-border bg-bg/50 hover:bg-surface-hover hover:border-text/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-surface flex items-center justify-center border border-border/80">
                            {getScaleIcon(scaleOption)}
                          </div>
                          <span className="font-serif text-sm font-bold text-text">
                            {config.name}
                          </span>
                        </div>
                        {isSavingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                        ) : isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-accent text-accent-contrast flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
                        {config.description}
                      </p>

                      {/* Live preview badge */}
                      <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
                        <span className="text-text-muted text-[10px] uppercase font-mono">
                          Preview:
                        </span>
                        <RatingBadge rating={85} scale={scaleOption} size="sm" />
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            {/* Information Callout */}
            <div className="p-3 rounded-lg bg-surface-elevated/60 border border-border/70 flex items-start gap-2.5 text-xs text-text-muted">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-text">Seamless Conversion:</strong> Ratings are stored as normalized 0–100 internally. Changing your scale preserves your exact evaluations and converts past logs effortlessly.
              </p>
            </div>
          </div>

          <div className="border-t border-border/70 pt-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">
              Profile Information
            </h3>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="settings-name"
                className="block text-xs font-semibold text-text-muted"
              >
                Display Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Your name or pseudonym"
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-colors"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label
                htmlFor="settings-bio"
                className="block text-xs font-semibold text-text-muted"
              >
                Bio / Journal Byline
              </label>
              <textarea
                id="settings-bio"
                rows={2}
                value={bio}
                onChange={(e) => setBioInput(e.target.value)}
                placeholder="A line about your taste in films, literature, and gaming..."
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-colors resize-none"
              />
            </div>

            {/* Appearance & Color Theme */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-text-muted">
                Color Theme & Atmosphere
              </label>
              <div className="p-3 rounded-xl bg-bg/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-text">Interface Palette</p>
                  <p className="text-[11px] text-text-muted">Switch between warm honey wood, cozy cabin dark, or match system.</p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            {/* Profile Visibility */}
            <div className="space-y-2 pt-1 border-t border-border/70">
              <label className="block text-xs font-semibold text-text-muted">
                Profile Visibility
              </label>
              <p className="text-[11px] text-text-muted -mt-1">
                Controls who can see your profile page (/u/[id]), bio, stats, and follow lists.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: "public",
                    label: "Public Profile",
                    desc: "Bio, stats, public logs, and follow network are visible to all.",
                    icon: Globe,
                  },
                  {
                    id: "private",
                    label: "Private Profile",
                    desc: "Only name and avatar appear. Bio, stats, logs, and follow lists stay hidden.",
                    icon: Lock,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = profileVisibility === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVisibilityInput(item.id as ProfileVisibility)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                          : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-accent" : ""}`} />
                        <span className="text-xs font-semibold text-text">{item.label}</span>
                      </div>
                      <span className="text-[10px] text-text-muted leading-tight">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Privacy */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-muted">
                Default Entry Privacy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                          : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-accent" : ""}`} />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </div>
                      <span className="text-[10px] opacity-75">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Algolia Search & Catalog Indexing Status Card */}
          <AlgoliaStatusCard />

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Save Preferences
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
