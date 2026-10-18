"use client";

import React, { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  Sparkles,
  Calendar,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  TrendingUp,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Flame,
  Copy,
  Check,
  ExternalLink,
  Globe,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useRatingScale } from "@/lib/rating-hook";
import { formatRatingForDisplay } from "@/lib/rating";

interface YearStatsData {
  year: number;
  total: number;
  byType: {
    movie: number;
    tv: number;
    game: number;
    book: number;
  };
  typeBreakdown: Array<{
    type: string;
    label: string;
    count: number;
  }>;
  mostLoggedType: string | null;
  topGenres: Array<{
    genre: string;
    count: number;
  }>;
  topRatedTitles: Array<{
    id: string;
    media_id: string;
    title: string;
    cover: string | null;
    type: string;
    rating: number;
    date: string;
  }>;
  averageRating: number | null;
  ratedCount: number;
  completedCount: number;
  busiestMonth: {
    month: number;
    name: string;
    label: string;
    count: number;
  } | null;
  monthly: Array<{
    month: number;
    name: string;
    label: string;
    count: number;
  }>;
  availableYears: number[];
}

const TYPE_COLORS: Record<string, string> = {
  movie: "#f59e0b", // Amber
  tv: "#8b5cf6",    // Purple
  game: "#10b981",  // Emerald
  book: "#0284c7",  // Sky
};

const TYPE_LABELS: Record<string, string> = {
  movie: "Films",
  tv: "TV Series",
  game: "Games",
  book: "Books",
};

const TYPE_ICONS: Record<string, typeof Film> = {
  movie: Film,
  tv: Tv,
  game: Gamepad2,
  book: BookOpen,
};

function YearInReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { scale } = useRatingScale();
  const shouldReduceMotion = useReducedMotion();

  const currentYear = new Date().getUTCFullYear();
  const requestedYearParam = searchParams.get("year");
  const selectedYear = requestedYearParam
    ? parseInt(requestedYearParam, 10) || currentYear
    : currentYear;

  const [stats, setStats] = useState<YearStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sharing state for selected year
  const [isShared, setIsShared] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHiddenProfile = profile?.profile_visibility === "private";

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const publicUrl =
    isMounted && typeof window !== "undefined" && user
      ? `${window.location.origin}/u/${user.id}/year/${selectedYear}`
      : "";

  // Check if current year is shared in shared_years table using normal client
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function checkShareStatus() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("shared_years")
          .select("year")
          .eq("user_id", user!.id)
          .eq("year", selectedYear)
          .maybeSingle();

        if (!cancelled) {
          if (!error && data) {
            setIsShared(true);
          } else {
            setIsShared(false);
          }
        }
      } catch (err) {
        console.error("Failed to check shared year status:", err);
      }
    }

    checkShareStatus();
    return () => {
      cancelled = true;
    };
  }, [user, selectedYear]);

  // Toggle share status: inserts when turning on, deletes when turning off (normal client)
  const handleToggleShare = async () => {
    if (!user || isShareLoading || isHiddenProfile) return;
    setIsShareLoading(true);
    const supabase = createClient();
    try {
      if (isShared) {
        const { error } = await supabase
          .from("shared_years")
          .delete()
          .eq("user_id", user.id)
          .eq("year", selectedYear);
        if (error) throw error;
        setIsShared(false);
      } else {
        const { error } = await supabase
          .from("shared_years")
          .insert({ user_id: user.id, year: selectedYear });
        if (error) throw error;
        setIsShared(true);
      }
    } catch (err) {
      console.error("Error updating year share status:", err);
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;

    let isSubscribed = true;
    async function fetchYearStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/year?year=${selectedYear}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load year recap (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (isSubscribed) {
          setStats(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          console.error("Year in review load error:", err);
          setError(err instanceof Error ? err.message : "Couldn't load recap");
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    fetchYearStats();
    return () => {
      isSubscribed = false;
    };
  }, [user, authLoading, selectedYear]);

  const handleYearChange = (year: number) => {
    router.push(`/year?year=${year}`);
  };

  const averageRatingDisplay = stats?.averageRating != null
    ? formatRatingForDisplay(stats.averageRating, scale)
    : null;

  const pieData = (stats?.typeBreakdown || [])
    .filter((t) => t.count > 0)
    .map((t) => ({
      name: t.label,
      value: t.count,
      color: TYPE_COLORS[t.type] || "#a8a29e",
    }));

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20 pb-24 font-sans">
      <TopNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Navigation & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <Link
            href="/stats"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors group font-mono w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to All-Time Stats</span>
          </Link>

          {/* Year Picker Dropdown */}
          {stats?.availableYears && stats.availableYears.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-mono text-text-muted">Viewing Year:</span>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="appearance-none bg-surface border border-border/80 text-text text-xs font-bold font-mono py-1.5 pl-3 pr-8 rounded-xl shadow-2xs hover:border-accent focus:border-accent focus:ring-1 focus:ring-accent outline-hidden cursor-pointer transition-colors"
                >
                  {stats.availableYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-surface text-text">
                      {yr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}
        </div>

        {/* SHARE THIS YEAR SWITCH CARD */}
        {user && (
          <div className="mb-6 sm:mb-8 p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 card-depth space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                {/* Switch button */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isShared}
                  disabled={isShareLoading || isHiddenProfile}
                  onClick={handleToggleShare}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 mt-0.5 sm:mt-0 ${
                    isShared && !isHiddenProfile ? "bg-accent" : "bg-bg-elevated border border-border"
                  } ${
                    isShareLoading || isHiddenProfile ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  aria-label={`Share ${selectedYear} year in review`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isShared && !isHiddenProfile ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-text">
                      Share this year
                    </span>
                    {isShareLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
                    {isShared && !isHiddenProfile && (
                      <Badge variant="subtle" size="sm" className="gap-1 font-mono text-[11px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                        <Globe className="w-3 h-3" />
                        <span>Public link active</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Only entries you&apos;ve marked public are included. Private and friends-only entries never appear.
                  </p>
                </div>
              </div>

              {/* Public link and Copy button (shown when on and profile not hidden) */}
              {isShared && !isHiddenProfile && publicUrl && (
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                  <div className="text-xs font-mono bg-bg px-3 py-1.5 rounded-xl border border-border text-text-muted max-w-[200px] sm:max-w-xs truncate select-all">
                    {publicUrl}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyLink}
                    leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Link href={`/u/${user.id}/year/${selectedYear}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" aria-label="Open public recap in new tab">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Hidden profile warning */}
            {isHiddenProfile && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Your profile is hidden, so this page will show as not found</span>
              </div>
            )}
          </div>
        )}

        {/* UNAUTHENTICATED STATE */}
        {!authLoading && !user && (
          <div className="p-8 sm:p-14 rounded-2xl bg-surface border border-border text-center space-y-4 max-w-lg mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-serif text-xl font-bold text-text">
                Sign in to view your Year in Review
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Your annual recap is private and compiled directly from your personal journal entries.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/">
                <Button variant="primary" size="md">
                  Go to Home to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs sm:text-sm text-text-muted font-mono">
              Composing your {selectedYear} Year in Review...
            </p>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-start gap-3 my-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{error}</p>
              <p className="text-xs text-rose-500/80">Please check your connection and try again.</p>
            </div>
          </div>
        )}

        {/* EMPTY STATE: Nothing logged in YEAR yet */}
        {!loading && !error && stats && stats.total === 0 && (
          <div className="p-8 sm:p-16 rounded-3xl bg-surface border border-border text-center space-y-5 max-w-lg mx-auto my-10 card-depth">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 text-accent flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text">
                Nothing logged in {selectedYear} yet
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
                No films, shows, games, or books were completed or logged in {selectedYear}. Select another year from the picker above, or log titles in your diary.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href="/diary">
                <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Go to Diary
                </Button>
              </Link>
              {stats.availableYears.length > 1 && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleYearChange(stats.availableYears[0])}
                >
                  View {stats.availableYears[0]}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* RECAP HERO & HIGHLIGHT CARDS (One deliberate fade-up motion on load) */}
        {!loading && !error && stats && stats.total > 0 && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* HERO RECAP CARD */}
            <div className="relative overflow-hidden p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-surface via-surface to-accent/10 border border-border/80 card-depth space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-accent font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Annual Recap</span>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-5xl sm:text-7xl font-black text-text tracking-tight">
                      {stats.year}
                    </span>
                    <span className="font-serif text-xl sm:text-3xl text-text-muted font-light">
                      in Review
                    </span>
                  </div>

                  <p className="text-sm sm:text-base text-text-muted leading-relaxed font-sans pt-1">
                    You logged <strong className="text-text font-bold">{stats.total} {stats.total === 1 ? "story" : "stories"}</strong> across films, literature, series, and games this year
                    {stats.mostLoggedType && (
                      <>, led primarily by <strong className="text-accent">{TYPE_LABELS[stats.mostLoggedType] || stats.mostLoggedType}</strong></>
                    )}
                    {averageRatingDisplay && (
                      <>, with an average evaluation of <strong className="text-amber-500 font-bold">{averageRatingDisplay.displayText}</strong></>
                    )}
                    {stats.busiestMonth && (
                      <>. Your most active creative season was <strong className="text-text font-bold">{stats.busiestMonth.name}</strong> ({stats.busiestMonth.count} entries).</>
                    )}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-border/60 pt-4 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Total Entries</div>
                    <div className="font-serif text-3xl sm:text-4xl font-black text-text">{stats.total}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Completed</div>
                    <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-500">{stats.completedCount}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* HIGHLIGHT 1 & 2 GRID: Type Mix + Top Genres */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Highlight Card 1: Media Mix */}
              <div className="p-6 rounded-3xl bg-surface border border-border/80 card-depth space-y-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-text">
                      Media Mix
                    </h3>
                    {stats.mostLoggedType && (
                      <Badge variant="amber" size="sm">
                        Favored: {TYPE_LABELS[stats.mostLoggedType] || stats.mostLoggedType}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    How you spent your cultural time in {stats.year}
                  </p>
                </div>

                <div className="h-48 w-full flex items-center justify-center relative">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-surface, #1e1e1e)",
                            borderColor: "var(--color-border, #333)",
                            borderRadius: "0.75rem",
                            fontSize: "0.75rem",
                            color: "var(--color-text, #fff)",
                          }}
                          itemStyle={{ color: "var(--color-text, #fff)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  {stats.typeBreakdown.map((item) => {
                    const Icon = TYPE_ICONS[item.type] || Film;
                    const color = TYPE_COLORS[item.type] || "#a8a29e";
                    const pct = Math.round((item.count / Math.max(1, stats.total)) * 100);
                    return (
                      <div
                        key={item.type}
                        className="flex items-center justify-between p-2 rounded-xl bg-bg/50 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                          <span className="font-medium text-text truncate">{item.label}</span>
                        </div>
                        <span className="text-text-muted font-mono text-[11px] shrink-0">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Highlight Card 2: Top 5 Genres */}
              <div className="p-6 rounded-3xl bg-surface border border-border/80 card-depth space-y-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-bold text-text">
                      Top 5 Genres
                    </h3>
                    <TrendingUp className="w-4 h-4 text-accent" />
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Themes and worlds that defined your {stats.year}
                  </p>
                </div>

                {stats.topGenres.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-text-muted italic">
                    No genre tags found in this year&apos;s entries.
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {stats.topGenres.map((g, idx) => {
                      const maxCount = stats.topGenres[0]?.count || 1;
                      const pct = Math.round((g.count / maxCount) * 100);
                      return (
                        <div key={g.genre} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-text flex items-center gap-2">
                              <span className="font-mono text-[10px] text-text-muted w-4">
                                #{idx + 1}
                              </span>
                              <span>{g.genre}</span>
                            </span>
                            <span className="font-mono text-text-muted text-[11px]">
                              {g.count} {g.count === 1 ? "title" : "titles"}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-bg rounded-full overflow-hidden border border-border/60">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="text-[11px] text-text-muted border-t border-border/60 pt-3 flex items-center justify-between">
                  <span>Normalized across your {stats.year} catalog</span>
                  <span className="font-mono">{stats.topGenres.length} genres</span>
                </div>
              </div>
            </div>

            {/* HIGHLIGHT 3: Top-Rated Titles with Covers */}
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border/80 card-depth space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-text">
                      Highest-Rated Titles
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Your 5 standout favorites of {stats.year} (ignoring unrated titles, ties broken by most recent)
                  </p>
                </div>

                {averageRatingDisplay && (
                  <Badge variant="amber" size="sm" className="font-mono self-start sm:self-auto py-1 px-3">
                    Year Average: {averageRatingDisplay.displayText}
                  </Badge>
                )}
              </div>

              {stats.topRatedTitles.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Star className="w-8 h-8 text-text-muted mx-auto stroke-1" />
                  <p className="text-xs text-text-muted">
                    No titles were given a rating in {stats.year}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {stats.topRatedTitles.map((titleItem, index) => {
                    const formatted = formatRatingForDisplay(titleItem.rating, scale);
                    const Icon = TYPE_ICONS[titleItem.type] || Film;

                    return (
                      <div
                        key={titleItem.id}
                        className="group flex flex-col justify-between p-2.5 rounded-2xl bg-surface-elevated/60 border border-border/80 hover:border-accent transition-all card-depth-hover"
                      >
                        <div className="space-y-2.5">
                          {/* Cover Image */}
                          <div className="relative aspect-2/3 w-full rounded-xl overflow-hidden bg-bg border border-border/60">
                            {titleItem.cover ? (
                              <Image
                                src={titleItem.cover}
                                alt={titleItem.title}
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-text-muted text-[11px]">
                                <Icon className="w-6 h-6 mb-1 text-text-muted/60" />
                                <span>No Cover</span>
                              </div>
                            )}

                            {/* Rank Badge */}
                            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/75 backdrop-blur-xs text-white font-mono font-bold text-xs flex items-center justify-center border border-white/20">
                              #{index + 1}
                            </div>
                          </div>

                          {/* Title & Metadata */}
                          <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-0.5">
                              <Icon className="w-3 h-3 text-accent" />
                              <span className="capitalize">{titleItem.type}</span>
                            </div>
                            <h4 className="text-xs font-bold text-text line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                              {titleItem.title}
                            </h4>
                          </div>
                        </div>

                        {/* Rating Display (respects user scale) */}
                        <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between text-xs">
                          <span className="text-[10px] text-text-muted font-mono uppercase">Score:</span>
                          <span className="font-bold text-amber-500 font-mono text-xs">
                            {formatted.displayText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* HIGHLIGHT 4: Busiest Month & Annual Rhythm */}
            <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-border/80 card-depth space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-accent" />
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-text">
                      Busiest Month & Annual Rhythm
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {stats.busiestMonth ? (
                      <>
                        <strong className="text-text font-bold">{stats.busiestMonth.name}</strong> was your peak month with <strong className="text-accent">{stats.busiestMonth.count} titles</strong> logged.
                      </>
                    ) : (
                      <>Monthly logging cadence throughout {stats.year}</>
                    )}
                  </p>
                </div>

                {stats.busiestMonth && (
                  <Badge variant="amber" size="sm" className="font-mono self-start sm:self-auto py-1 px-3">
                    Peak: {stats.busiestMonth.name}
                  </Badge>
                )}
              </div>

              <div className="h-64 w-full pt-2">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.monthly}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted, #888)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-text-muted, #888)" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface, #1e1e1e)",
                          borderColor: "var(--color-border, #333)",
                          borderRadius: "0.75rem",
                          fontSize: "0.75rem",
                          color: "var(--color-text, #fff)",
                        }}
                        formatter={(value) => [`${value} entries`, "Logged"]}
                      />
                      <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        fill="var(--color-accent, #d97706)"
                      >
                        {stats.monthly.map((entry) => (
                          <Cell
                            key={`month-${entry.month}`}
                            fill={
                              stats.busiestMonth && entry.month === stats.busiestMonth.month
                                ? "#f59e0b"
                                : "var(--color-accent, #d97706)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function YearInReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg text-text pb-24 font-sans">
          <TopNav />
          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 flex flex-col items-center justify-center p-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs sm:text-sm text-text-muted font-mono">
              Loading Year in Review...
            </p>
          </main>
        </div>
      }
    >
      <YearInReviewContent />
    </Suspense>
  );
}
