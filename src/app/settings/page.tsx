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
  Zap,
  Database,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
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
import { getAlgoliaClientConfig } from "@/lib/algolia";
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

  // Algolia Backfill State
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean;
    message?: string;
    totalIndexed?: number;
    indexName?: string;
    error?: string;
  } | null>(null);

  const algoliaClientConfig = getAlgoliaClientConfig();

  const handleRunBackfill = async () => {
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/algolia/backfill", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Backfill failed");
      }
      setBackfillResult({
        success: true,
        message: data.message,
        totalIndexed: data.totalIndexed,
        indexName: data.indexName,
      });
    } catch (err: unknown) {
      setBackfillResult({
        success: false,
        error: err instanceof Error ? err.message : "Backfill request failed",
      });
    } finally {
      setIsBackfilling(false);
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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb / Return */}
        <div>
          <Link
            href="/diary"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-medium transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Return to Media Journal</span>
          </Link>
        </div>

        {/* Page Title */}
        <div className="border-b border-border pb-6 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-accent font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text">
            Profile & Journal Settings
          </h1>
          <p className="text-sm text-text-muted font-sans max-w-xl">
            Customize your rating scale format and journal privacy defaults.
          </p>
        </div>

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

        <form onSubmit={handleSave} className="space-y-8">
          {/* Card: Rating Scale */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-text">
                  Rating Scale
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Select your preferred evaluation format. All ratings are stored as 0–100 internally and seamlessly convert between scales.
                </p>
              </div>
              <Badge variant="amber" size="sm" className="font-mono text-[10px] self-start sm:self-auto">
                Normalized 0–100 Engine
              </Badge>
            </div>

            {/* 4 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent"
                          : "border-border bg-bg/50 hover:bg-surface-hover hover:border-text/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-border/80">
                            {getScaleIcon(scaleOption)}
                          </div>
                          <div>
                            <span className="font-serif text-base font-bold text-text block">
                              {config.name}
                            </span>
                            <span className="text-[11px] font-mono text-text-muted">
                              {config.example}
                            </span>
                          </div>
                        </div>
                        {isSavingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-accent text-accent-contrast flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-text-muted leading-relaxed">
                        {config.description}
                      </p>

                      {/* Live preview */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                        <span className="text-text-muted text-[11px] uppercase font-mono">
                          Live Sample:
                        </span>
                        <RatingBadge rating={85} scale={scaleOption} size="sm" />
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-surface-elevated/60 border border-border/70 flex items-start gap-2.5 text-xs text-text-muted">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-text">Cross-Scale Preservation:</strong> If you switch from 5-Star (e.g. 4.0 ★) to 100-Point, your score displays as 80 / 100. Switching to Thumbs Up/Down displays as 👍 Liked. Your diary entries and reviews adapt everywhere.
              </p>
            </div>
          </div>

          {/* Card: Profile Defaults */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-5">
            <h2 className="font-serif text-lg font-bold text-text border-b border-border/70 pb-3">
              Journal Byline & Privacy
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-muted">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-muted">
                  Bio / Journal Intro
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Short tagline about your media taste"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-text-muted">
                Default Entry Privacy
              </label>
              <div className="grid grid-cols-3 gap-3">
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
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? "border-accent bg-accent/10 text-text"
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

          {/* Card: Algolia Search & Catalog Indexing */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent text-accent-contrast flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-serif text-lg font-bold text-text">
                    Algolia Search & Catalog Indexing
                  </h2>
                </div>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Real-time typo-tolerant catalog search with automated Postgres triggers and Supabase Edge Functions.
                </p>
              </div>

              <Badge
                variant={algoliaClientConfig.isConfigured ? "forest" : "amber"}
                size="sm"
                className="shrink-0 text-[11px]"
              >
                {algoliaClientConfig.isConfigured
                  ? "Algolia Connected"
                  : "Algolia Pending Setup"}
              </Badge>
            </div>

            {/* Algolia Configuration Status Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Application ID
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  {algoliaClientConfig.appId ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {algoliaClientConfig.appId.slice(0, 4)}••••
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Not set in env
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Search-Only Key (Client)
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  {algoliaClientConfig.searchApiKey ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {algoliaClientConfig.searchApiKey.slice(0, 4)}••••
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Not set in env
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Target Index
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-text font-semibold">
                  <Database className="w-3 h-3 text-accent" />
                  <span>{algoliaClientConfig.indexName}</span>
                </div>
              </div>
            </div>

            {/* Backfill Section */}
            <div className="p-4 rounded-xl border border-border/80 bg-surface-elevated/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-accent" />
                    <span>One-Time Algolia Backfill</span>
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Bulk-indexes every existing row in the <code className="font-mono text-[11px] bg-bg px-1 py-0.5 rounded border border-border">media</code> table into Algolia, so titles synced before this change become instantly searchable.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isBackfilling}
                  onClick={handleRunBackfill}
                  className="shrink-0 gap-1.5 text-xs shadow-xs"
                >
                  {isBackfilling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Indexing Rows...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Run Backfill Now</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Backfill Result Feedback */}
              {backfillResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in ${
                    backfillResult.success
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400"
                  }`}
                >
                  {backfillResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 leading-relaxed">
                    <strong className="block font-semibold">
                      {backfillResult.success ? "Backfill Complete" : "Backfill Failed"}
                    </strong>
                    <span>
                      {backfillResult.message || backfillResult.error}
                    </span>
                    {backfillResult.totalIndexed !== undefined && (
                      <span className="block font-mono text-[11px] mt-1">
                        Indexed: {backfillResult.totalIndexed} items into &apos;{backfillResult.indexName}&apos;
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Developer References */}
            <div className="p-3.5 rounded-lg bg-bg/60 border border-border/80 space-y-2 text-xs text-text-muted">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>CLI & Trigger Execution Reference</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] list-disc list-inside text-text-muted">
                <li>
                  <strong className="text-text">CLI Command:</strong> <code className="bg-surface px-1 py-0.5 rounded border border-border">npm run algolia:backfill</code>
                </li>
                <li>
                  <strong className="text-text">Admin API:</strong> <code className="bg-surface px-1 py-0.5 rounded border border-border">POST /api/admin/algolia/backfill</code>
                </li>
                <li>
                  <strong className="text-text">Database Trigger:</strong> <code className="bg-surface px-1 py-0.5 rounded border border-border">AFTER INSERT OR UPDATE ON public.media</code>
                </li>
                <li>
                  <strong className="text-text">Supabase Edge Function:</strong> <code className="bg-surface px-1 py-0.5 rounded border border-border">supabase/functions/algolia-sync</code>
                </li>
              </ul>
            </div>
          </div>

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
