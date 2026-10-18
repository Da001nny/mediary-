"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  ArrowRight,
  Library,
  Layers,
} from "lucide-react";
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
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useRatingScale } from "@/lib/rating-hook";
import {
  formatRatingForDisplay,
  RATING_SCALE_CONFIG,
} from "@/lib/rating";

interface StatsData {
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
  topGenres: Array<{
    genre: string;
    count: number;
  }>;
  ratingDistribution: Array<{
    bucket: string;
    min: number;
    max: number;
    count: number;
  }>;
  averageRating: number | null;
  ratedCount: number;
  monthly: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  statusCounts: {
    planned: number;
    in_progress: number;
    completed: number;
    dropped: number;
    on_hold: number;
  };
  statusBreakdown: Array<{
    status: string;
    label: string;
    count: number;
  }>;
}

const TYPE_COLORS: Record<string, string> = {
  movie: "#f59e0b", // Amber
  tv: "#8b5cf6",    // Purple
  game: "#10b981",  // Emerald
  book: "#0284c7",  // Sky
};

const TYPE_ICONS: Record<string, typeof Film> = {
  movie: Film,
  tv: Tv,
  game: Gamepad2,
  book: BookOpen,
};

export default function StatsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { scale } = useRatingScale();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (authLoading || !user) return;

    let isSubscribed = true;
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load stats (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (isSubscribed) {
          setStats(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          console.error("Failed to fetch stats:", err);
          setError(err instanceof Error ? err.message : "Couldn't load stats");
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    fetchStats();
    return () => {
      isSubscribed = false;
    };
  }, [user, authLoading]);

  // Format rating display according to user's rating_scale setting
  const averageRatingDisplay = stats?.averageRating != null
    ? formatRatingForDisplay(stats.averageRating, scale)
    : null;

  // Custom bucket labels adapted to user's scale
  const getRatingBucketLabel = (index: number) => {
    if (scale === "5-star") {
      const stars = ((index + 1) * 0.5).toFixed(1);
      return `${stars}★`;
    }
    if (scale === "10-point") {
      return `${index + 1}`;
    }
    if (scale === "100-point") {
      return `${(index + 1) * 10}`;
    }
    // thumbs
    return index < 5 ? "👎" : "👍";
  };

  const pieData = (stats?.typeBreakdown || [])
    .filter((t) => t.count > 0)
    .map((t) => ({
      name: t.label,
      value: t.count,
      color: TYPE_COLORS[t.type] || "#a8a29e",
    }));

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20 pb-20 font-sans">
      <TopNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Header Breadcrumbs & Title */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2 font-mono">
            <Link href="/diary" className="hover:text-text transition-colors">
              Diary
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-text font-medium">Personal Statistics</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/80 pb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-accent font-bold font-mono mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Media Analytics</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-text">
                Personal Stats & Insights
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-text-muted max-w-2xl leading-relaxed">
                A birds-eye view of your taste, genres, evaluation patterns, and reading & viewing rhythm.
              </p>
            </div>

            {stats && stats.total >= 3 && (
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="amber" size="sm" className="font-mono text-xs py-1 px-2.5">
                  Scale: {RATING_SCALE_CONFIG[scale]?.name || scale}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* UNAUTHENTICATED STATE */}
        {!authLoading && !user && (
          <div className="p-8 sm:p-14 rounded-2xl bg-surface border border-border text-center space-y-4 max-w-lg mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center mx-auto">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-serif text-xl font-bold text-text">
                Sign in to view your statistics
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Your personal stats are computed strictly from your private and public media logs.
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
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs sm:text-sm text-text-muted">Computing media statistics...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-start gap-3 my-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{error}</p>
              <p className="text-xs text-rose-500/80">Please check your network connection and try again.</p>
            </div>
          </div>
        )}

        {/* EMPTY STATE: Less than 3 entries */}
        {!loading && !error && stats && stats.total < 3 && (
          <div className="p-8 sm:p-14 rounded-2xl bg-surface border border-border text-center space-y-5 max-w-lg mx-auto my-10 card-depth">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/25 text-accent flex items-center justify-center mx-auto">
              <Library className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
                Log a few titles to see your stats
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                You have {stats.total === 0 ? "no entries logged yet" : stats.total === 1 ? "only 1 title logged" : "only 2 titles logged"}. Add at least 3 titles to your media diary to generate your media mix, genre distribution, rating curves, and monthly rhythms.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href="/diary">
                <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Go to Diary
                </Button>
              </Link>
              <Link href="/import">
                <Button variant="secondary" size="md">
                  Import from Letterboxd / Goodreads
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* FULL DASHBOARD: 3 or more entries */}
        {!loading && !error && stats && stats.total >= 3 && (
          <div className="space-y-8">
            {/* KEY NUMBERS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Logged */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 card-depth space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider font-mono">Total Logged</span>
                  <Library className="w-4 h-4 text-accent" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl font-black text-text">
                  {stats.total}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {stats.byType.movie} films · {stats.byType.book} books · {stats.byType.tv} tv · {stats.byType.game} games
                </div>
              </div>

              {/* Completed Titles */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 card-depth space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider font-mono">Completed</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl font-black text-emerald-500">
                  {stats.statusCounts.completed}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {Math.round((stats.statusCounts.completed / Math.max(1, stats.total)) * 100)}% of total library
                </div>
              </div>

              {/* Average Rating */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 card-depth space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider font-mono">Avg Rating</span>
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                </div>
                <div className="font-serif text-2xl sm:text-3xl font-black text-text truncate">
                  {averageRatingDisplay ? averageRatingDisplay.displayText : "—"}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {stats.ratedCount} rated {stats.ratedCount === 1 ? "entry" : "entries"} ({scale})
                </div>
              </div>

              {/* Top Genre */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border/80 card-depth space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider font-mono">Top Genre</span>
                  <TrendingUp className="w-4 h-4 text-accent" />
                </div>
                <div className="font-serif text-xl sm:text-2xl font-black text-text truncate">
                  {stats.topGenres[0]?.genre || "None"}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {stats.topGenres[0] ? `${stats.topGenres[0].count} titles tagged` : "No tags yet"}
                </div>
              </div>
            </div>

            {/* CHARTS GRID ROW 1: Type Mix & Top Genres */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Type Mix Chart (5 cols) */}
              <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-base sm:text-lg font-bold text-text">
                      Media Mix
                    </h2>
                    <Badge variant="outline" size="sm">
                      {pieData.length} Types
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Proportion of logged titles by medium
                  </p>
                </div>

                <div className="h-60 w-full relative flex items-center justify-center">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
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

                {/* Legend Breakdown */}
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
                          <Icon
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color }}
                          />
                          <span className="font-medium text-text truncate">{item.label}</span>
                        </div>
                        <span className="text-text-muted font-mono text-[11px] shrink-0 pl-1">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top 8 Genres Bar Chart (7 cols) */}
              <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-text">
                      Top 8 Genres
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Most frequent genres across your media catalog
                    </p>
                  </div>
                  <Badge variant="amber" size="sm">
                    {stats.topGenres.length} Detected
                  </Badge>
                </div>

                {stats.topGenres.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-text-muted italic">
                    No genre metadata found in logged titles.
                  </div>
                ) : (
                  <div className="h-72 w-full pt-2">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.topGenres}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "var(--color-text-muted, #888)" }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="genre"
                            tick={{ fontSize: 11, fill: "var(--color-text, #eee)" }}
                            width={90}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                            contentStyle={{
                              backgroundColor: "var(--color-surface, #1e1e1e)",
                              borderColor: "var(--color-border, #333)",
                              borderRadius: "0.75rem",
                              fontSize: "0.75rem",
                              color: "var(--color-text, #fff)",
                            }}
                            formatter={(value) => [`${value} titles`, "Logged"]}
                          />
                          <Bar dataKey="count" fill="var(--color-accent, #d97706)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CHARTS GRID ROW 2: Ratings Histogram & Monthly Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Ratings Histogram (6 cols) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-text">
                      Rating Distribution
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      10 buckets across 0–100 normalized scores (rendered in {RATING_SCALE_CONFIG[scale]?.name})
                    </p>
                  </div>
                  {averageRatingDisplay && (
                    <div className="text-xs text-accent font-semibold font-mono">
                      Avg: {averageRatingDisplay.displayText}
                    </div>
                  )}
                </div>

                {stats.ratedCount === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-text-muted italic">
                    No rated titles yet. Rate entries in your diary to unlock your curve.
                  </div>
                ) : (
                  <div className="h-64 w-full pt-2">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.ratingDistribution.map((item, idx) => ({
                            ...item,
                            displayLabel: getRatingBucketLabel(idx),
                          }))}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                          <XAxis
                            dataKey="displayLabel"
                            tick={{ fontSize: 10, fill: "var(--color-text-muted, #888)" }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "var(--color-text-muted, #888)" }}
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
                            formatter={(value, _name, item) => {
                              const bucket = (item as { payload?: { bucket?: string } })?.payload?.bucket || "";
                              return [`${value} entries (${bucket} score)`, "Ratings"];
                            }}
                          />
                          <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>

              {/* Monthly Activity Rhythm (6 cols) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-base sm:text-lg font-bold text-text">
                      Logging Rhythm
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Entries added per month over the last 12 months
                    </p>
                  </div>
                  <Badge variant="outline" size="sm">
                    12 Months
                  </Badge>
                </div>

                <div className="h-64 w-full pt-2">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={stats.monthly}
                        margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="monthGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-accent, #d97706)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--color-accent, #d97706)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "var(--color-text-muted, #888)" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--color-text-muted, #888)" }}
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
                          formatter={(value) => [`${value} logged`, "Activity"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="var(--color-accent, #d97706)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#monthGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* STATUS BREAKDOWN ROW */}
            <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 card-depth space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-base sm:text-lg font-bold text-text">
                    Status Overview
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Current stage of all titles in your personal library
                  </p>
                </div>
                <Layers className="w-4 h-4 text-accent" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { key: "completed", label: "Completed", count: stats.statusCounts.completed, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
                  { key: "in_progress", label: "In Progress", count: stats.statusCounts.in_progress, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
                  { key: "planned", label: "Planned", count: stats.statusCounts.planned, color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
                  { key: "on_hold", label: "On Hold", count: stats.statusCounts.on_hold, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
                  { key: "dropped", label: "Dropped", count: stats.statusCounts.dropped, color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
                ].map((item) => (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${item.color}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                    <div className="font-serif text-2xl font-black">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
