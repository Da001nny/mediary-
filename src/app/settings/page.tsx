"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Upload,
  ArrowRight,
  Download,
  AlertTriangle,
  Trash2,
  X,
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
import type { PrivacyLevel, ProfileVisibility } from "@/types/database.types";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, updateProfile, user, signOut } = useAuth();
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
  const [visibilityInput, setVisibilityInput] = useState<ProfileVisibility | null>(null);

  const displayName = displayNameInput ?? (profile?.display_name || user?.user_metadata?.full_name || "");
  const bio = bioInput ?? (profile?.bio || "");
  const defaultPrivacy = privacyInput ?? (profile?.default_privacy || "private");
  const profileVisibility: ProfileVisibility =
    visibilityInput ??
    profile?.profile_visibility ??
    (profile?.default_privacy === "private" ? "private" : "public");

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Account deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const userEmail = (user?.email || "").trim().toLowerCase();
  const isEmailMatching =
    confirmEmailInput.trim().toLowerCase() === userEmail && userEmail.length > 0;

  const handleDeleteAccount = async () => {
    if (!isEmailMatching || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmEmailInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete account (HTTP ${res.status})`);
      }

      // Delete required localStorage keys
      const KEYS_TO_DELETE = [
        "mediary_diary_entries",
        "mediary_custom_lists_v1",
        "mediary_demo_auth_user",
        "mediary_user_profile",
      ];
      KEYS_TO_DELETE.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      });

      // Sign out and redirect to home with deletion message
      await signOut();
      router.push("/?deleted=true");
    } catch (err: unknown) {
      console.error("Account deletion error:", err);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

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
        profile_visibility: profileVisibility,
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-16 space-y-6 sm:space-y-12">
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
        <div className="border-b border-border/80 pb-6 sm:pb-8 space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-bold font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>User Preferences</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-black text-text tracking-tight">
            Profile & Journal Settings
          </h1>
          <p className="text-xs sm:text-base text-text-muted font-sans max-w-2xl leading-relaxed">
            Customize your rating scale format, journal privacy defaults, and catalog synchronization.
          </p>
        </div>

        {error && (
          <div className="p-3.5 sm:p-4 text-xs sm:text-sm rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 sm:p-4 text-xs sm:text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8 sm:space-y-12">
          {/* Card: Rating Scale */}
          <div className="p-4 sm:p-7 lg:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4 sm:pb-5">
              <div>
                <h2 className="font-serif text-lg sm:text-2xl font-bold text-text">
                  Rating Scale
                </h2>
                <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                  Select your preferred evaluation format. All ratings are stored as 0–100 internally and seamlessly convert between scales.
                </p>
              </div>
              <Badge variant="amber" size="sm" className="font-mono text-[10px] sm:text-xs self-start sm:self-auto py-1 px-2.5">
                Normalized 0–100 Engine
              </Badge>
            </div>

            {/* 4 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
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
                      className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 sm:gap-4 card-depth-hover ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent"
                          : "border-border/80 bg-bg/50 hover:bg-surface-hover hover:border-text/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-surface flex items-center justify-center border border-border/80 shadow-2xs shrink-0">
                            {getScaleIcon(scaleOption)}
                          </div>
                          <div>
                            <span className="font-serif text-sm sm:text-lg font-bold text-text block">
                              {config.name}
                            </span>
                            <span className="text-[11px] sm:text-xs font-mono text-text-muted">
                              {config.example}
                            </span>
                          </div>
                        </div>
                        {isSavingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        ) : isSelected ? (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-xs shrink-0">
                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-text-muted leading-relaxed">
                        {config.description}
                      </p>

                      {/* Live preview */}
                      <div className="pt-2.5 sm:pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                        <span className="text-text-muted text-[10px] sm:text-[11px] uppercase font-mono font-semibold">
                          Live Sample:
                        </span>
                        <RatingBadge rating={85} scale={scaleOption} size="sm" />
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-surface-elevated/60 border border-border/70 flex items-start gap-2.5 sm:gap-3 text-xs text-text-muted">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-text font-semibold">Cross-Scale Preservation:</strong> If you switch from 5-Star (e.g. 4.0 ★) to 100-Point, your score displays as 80 / 100. Switching to Thumbs Up/Down displays as 👍 Liked. Your diary entries and reviews adapt everywhere.
              </p>
            </div>
          </div>

          {/* Card: Profile Defaults */}
          <div className="p-4 sm:p-7 lg:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-5 sm:space-y-6">
            <h2 className="font-serif text-lg sm:text-2xl font-bold text-text border-b border-border/70 pb-3 sm:pb-4">
              Journal Byline & Privacy
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your Name"
                  className="w-full h-10 sm:h-11 px-3.5 sm:px-4 text-xs sm:text-sm rounded-xl bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-all shadow-2xs"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                  Bio / Journal Intro
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Short tagline about your media taste"
                  className="w-full h-10 sm:h-11 px-3.5 sm:px-4 text-xs sm:text-sm rounded-xl bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Profile Visibility */}
            <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2 border-t border-border/70">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text">
                  Profile Visibility
                </label>
                <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">
                  Controls who can see your profile page (/u/[id]), bio, stats, and follow network.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
                {[
                  {
                    id: "public",
                    label: "Public Profile",
                    desc: "Bio, stats, public logs, and follow lists are visible to all visitors.",
                    icon: Globe,
                  },
                  {
                    id: "private",
                    label: "Hide my profile page",
                    desc: "Your profile page, followers and feed activity are hidden from others. Your name and avatar still appear on comments, and entries or lists you've marked public stay visible to anyone who has the link.",
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
                      className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                          : "border-border/80 bg-bg/50 hover:bg-surface-hover text-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-accent" : ""}`} />
                        <span className="text-xs sm:text-sm font-bold text-text">{item.label}</span>
                      </div>
                      <span className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                Default privacy for new entries and lists
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                {[
                  { id: "private", label: "Private", desc: "Only you", icon: Lock },
                  { id: "friends", label: "Friends", desc: "People you follow who follow you back", icon: Users },
                  { id: "public", label: "Public", desc: "Anyone, including visitors", icon: Globe },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = defaultPrivacy === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPrivacyInput(item.id as PrivacyLevel)}
                      className={`p-3 sm:p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 sm:gap-1.5 ${
                        isSelected
                          ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                          : "border-border/80 bg-bg/50 hover:bg-surface-hover text-text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-accent" : ""}`} />
                        <span className="text-xs sm:text-sm font-bold text-text">{item.label}</span>
                      </div>
                      <span className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card: Import from Letterboxd & Goodreads */}
          {user && (
            <div className="p-4 sm:p-7 lg:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg sm:text-2xl font-bold text-text">
                    Data Import
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                    Import your history from Letterboxd or Goodreads
                  </p>
                </div>

                <Link href="/import" className="shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Upload className="w-4 h-4 text-accent" />}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Import Library
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Card: Download My Data */}
          {user && (
            <div className="p-4 sm:p-7 lg:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg sm:text-2xl font-bold text-text">
                    Download My Data
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                    Export a full JSON backup of your profile, entries, lists, comments, likes, and history
                  </p>
                </div>

                <a href="/api/account/export" download className="shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4 text-accent" />}
                  >
                    Download Data (JSON)
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Card: Algolia Search & Catalog Indexing */}
          <AlgoliaStatusCard />

          {/* Section: Danger zone */}
          {user && (
            <div className="p-4 sm:p-7 lg:p-9 rounded-2xl bg-rose-500/5 border border-rose-500/30 card-depth space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-rose-500">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <h2 className="font-serif text-lg sm:text-2xl font-bold">
                      Danger zone
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed max-w-xl">
                    Permanently delete your account and all associated entries, reviews, lists, comments, likes, and history. This action cannot be undone.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsDeleteModalOpen(true);
                    setDeleteError(null);
                    setConfirmEmailInput("");
                  }}
                  leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
                  className="shrink-0 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500"
                >
                  Delete my account
                </Button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
            <Link href="/diary" className="w-full sm:w-auto">
              <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto justify-center">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              leftIcon={<Check className="w-4 h-4" />}
              className="w-full sm:w-auto justify-center"
            >
              Save All Settings
            </Button>
          </div>
        </form>

        {/* Legal & Policies Links */}
        <div className="mt-10 pt-6 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <p className="font-mono text-[11px]">meDiary Policies</p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-text-muted hover:text-text transition-colors underline-offset-4 hover:underline"
            >
              Privacy
            </Link>
            <span className="text-border">•</span>
            <Link
              href="/terms"
              className="text-text-muted hover:text-text transition-colors underline-offset-4 hover:underline"
            >
              Terms
            </Link>
          </div>
        </div>
      </main>

      {/* Confirmation Dialog: Delete Account */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-rose-500/40 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-border/80 pb-4">
              <div className="flex items-center gap-2.5 text-rose-500">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-serif text-lg sm:text-xl font-bold text-text">
                  Delete your account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-text-muted hover:text-text p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-text-muted leading-relaxed">
              <p className="font-semibold text-rose-500">
                This action cannot be undone.
              </p>
              <p>
                Deleting your account will permanently remove all your data from meDiary, including:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-text">
                <li>Entries and ratings</li>
                <li>Reviews and spoiler notes</li>
                <li>Custom lists and list items</li>
                <li>Comments and replies</li>
                <li>Likes given across entries and lists</li>
                <li>Follows and followers</li>
                <li>Import jobs and import history</li>
                <li>Shared year in review pages</li>
              </ul>
            </div>

            {/* Suggest downloading data first */}
            <div className="p-3.5 rounded-xl bg-bg border border-border flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-text">Save your records first?</div>
                <div className="text-[11px] text-text-muted">
                  We suggest downloading a complete JSON archive before deleting your account.
                </div>
              </div>
              <a href="/api/account/export" download className="shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-3.5 h-3.5 text-accent" />}
                >
                  Download data
                </Button>
              </a>
            </div>

            {/* Email confirmation requirement */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-mono text-text">
                To confirm, type your account email <strong className="text-accent">({user?.email})</strong>:
              </label>
              <input
                type="email"
                autoComplete="off"
                value={confirmEmailInput}
                onChange={(e) => setConfirmEmailInput(e.target.value)}
                placeholder={user?.email || "your.email@example.com"}
                className="w-full bg-bg border border-border/90 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-text focus:outline-hidden focus:border-rose-500 font-mono"
              />
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/80">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={!isEmailMatching || isDeleting}
                isLoading={isDeleting}
                onClick={handleDeleteAccount}
                leftIcon={<Trash2 className="w-4 h-4 text-white" />}
                className="bg-rose-600 hover:bg-rose-700 text-white border-transparent disabled:opacity-40"
              >
                Delete Account Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
