"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  TrendingUp,
  ArrowLeft,
  Flame,
  Globe,
  Calendar,
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
} from "recharts";
import { TopNav } from "@/components/navigation/TopNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useRatingScale } from "@/lib/rating-hook";
import { formatRatingForDisplay } from "@/lib/rating";

export interface PublicYearRecapData {
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
}

export interface PublicPersonData {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PublicYearViewProps {
  recap: PublicYearRecapData;
  person: PublicPersonData;
}

const TYPE_COLORS: Record<string, string> = {
  movie: "#f59e0b",
  tv: "#8b5cf6",
  game: "#10b981",
  book: "#0284c7",
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

function getMonogram(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export function PublicYearView({ recap, person }: PublicYearViewProps) {
  const { scale } = useRatingScale();
  const shouldReduceMotion = useReducedMotion();

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const averageRatingDisplay =
    recap.averageRating != null
      ? formatRatingForDisplay(recap.averageRating, scale)
      : null;

  const pieData = (recap.typeBreakdown || [])
    .filter((t) => t.count > 0)
    .map((t) => ({
      name: t.label,
      value: t.count,
      color: TYPE_COLORS[t.type] || "#a8a29e",
    }));

  const displayName = person.display_name || "User";

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20 pb-24 font-sans">
      <TopNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Navigation & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <Link
            href={`/u/${person.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors group font-mono w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to {displayName}&apos;s profile</span>
          </Link>

          {/* Label: Based on public entries */}
          <div className="flex items-center gap-2">
            <Badge variant="subtle" size="sm" className="gap-1.5 font-mono text-xs">
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span>Based on public entries</span>
            </Badge>
          </div>
        </div>

        {/* EMPTY STATE */}
        {recap.total === 0 ? (
          <div className="p-8 sm:p-16 rounded-3xl bg-surface border border-border text-center space-y-5 max-w-lg mx-auto my-10 card-depth">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 text-accent flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text">
                Nothing logged in {recap.year} yet
              </h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
                No public films, shows, games, or books were logged by {displayName} in {recap.year}.
              </p>
            </div>
            <div className="pt-2">
              <Link href={`/u/${person.id}`}>
                <Button variant="secondary" size="md">
                  View {displayName}&apos;s Profile
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* RECAP HERO & HIGHLIGHT CARDS (One deliberate fade-up motion on load) */
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* HERO RECAP CARD */}
            <div className="relative overflow-hidden p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-surface via-surface to-accent/10 border border-border/80 card-depth space-y-5">
              {/* Person header */}
              <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/60 pb-4">
                <Link
                  href={`/u/${person.id}`}
                  className="flex items-center gap-3 group transition-opacity hover:opacity-90"
                >
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-bg border border-border/80 flex items-center justify-center font-bold font-serif text-accent text-sm shrink-0">
                    {person.avatar_url ? (
                      <Image
                        src={person.avatar_url}
                        alt={displayName}
                        fill
                        sizes="40px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{getMonogram(displayName)}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                      {displayName}
                    </h2>
                    <span className="text-[11px] font-mono text-text-muted">
                      Shared Year in Review
                    </span>
                  </div>
                </Link>

                <Badge variant="subtle" size="sm" className="gap-1 text-[11px] font-mono">
                  <Globe className="w-3 h-3 text-accent" />
                  <span>Based on public entries</span>
                </Badge>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-1">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-accent font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Annual Recap</span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-5xl sm:text-7xl font-black text-text tracking-tight">
                      {recap.year}
                    </span>
                    <span className="font-serif text-xl sm:text-3xl text-text-muted font-light">
                      in Review
                    </span>
                  </div>

                  <p className="text-sm sm:text-base text-text-muted leading-relaxed font-sans pt-1">
                    Logged <strong className="text-text font-bold">{recap.total} {recap.total === 1 ? "story" : "stories"}</strong> publicly across films, literature, series, and games in {recap.year}
                    {recap.mostLoggedType && (
                      <>, led primarily by <strong className="text-accent">{TYPE_LABELS[recap.mostLoggedType] || recap.mostLoggedType}</strong></>
                    )}
                    {averageRatingDisplay && (
                      <>, with an average evaluation of <strong className="text-amber-500 font-bold">{averageRatingDisplay.displayText}</strong></>
                    )}
                    {recap.busiestMonth && (
                      <>. Most active creative season was <strong className="text-text font-bold">{recap.busiestMonth.name}</strong> ({recap.busiestMonth.count} entries).</>
                    )}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-border/60 pt-4 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Public Entries</div>
                    <div className="font-serif text-3xl sm:text-4xl font-black text-text">{recap.total}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Completed</div>
                    <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-500">{recap.completedCount}</div>
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
                    {recap.mostLoggedType && (
                      <Badge variant="amber" size="sm">
                        Favored: {TYPE_LABELS[recap.mostLoggedType] || recap.mostLoggedType}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    How cultural time was spent in {recap.year}
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
                  {recap.typeBreakdown.map((item) => {
                    const Icon = TYPE_ICONS[item.type] || Film;
                    const color = TYPE_COLORS[item.type] || "#a8a29e";
                    const pct = Math.round((item.count / Math.max(1, recap.total)) * 100);
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
                    Themes and worlds defining {displayName}&apos;s {recap.year}
                  </p>
                </div>

                {recap.topGenres.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-text-muted italic">
                    No genre tags found in public entries.
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {recap.topGenres.map((g, idx) => {
                      const maxCount = recap.topGenres[0]?.count || 1;
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
                  <span>Based on public entries</span>
                  <span className="font-mono">{recap.topGenres.length} genres</span>
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
                    Standout favorites of {recap.year} from public entries
                  </p>
                </div>

                {averageRatingDisplay && (
                  <Badge variant="amber" size="sm" className="font-mono self-start sm:self-auto py-1 px-3">
                    Year Average: {averageRatingDisplay.displayText}
                  </Badge>
                )}
              </div>

              {recap.topRatedTitles.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Star className="w-8 h-8 text-text-muted mx-auto stroke-1" />
                  <p className="text-xs text-text-muted">
                    No public titles were rated in {recap.year}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {recap.topRatedTitles.map((titleItem, index) => {
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

                        {/* Rating Display */}
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
                    {recap.busiestMonth ? (
                      <>
                        <strong className="text-text font-bold">{recap.busiestMonth.name}</strong> was the peak month with <strong className="text-accent">{recap.busiestMonth.count} public titles</strong> logged.
                      </>
                    ) : (
                      <>Monthly logging cadence throughout {recap.year}</>
                    )}
                  </p>
                </div>

                {recap.busiestMonth && (
                  <Badge variant="amber" size="sm" className="font-mono self-start sm:self-auto py-1 px-3">
                    Peak: {recap.busiestMonth.name}
                  </Badge>
                )}
              </div>

              <div className="h-64 w-full pt-2">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={recap.monthly}
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
                        formatter={(value) => [`${value} entries`, "Public Logs"]}
                      />
                      <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        fill="var(--color-accent, #d97706)"
                      >
                        {recap.monthly.map((entry) => (
                          <Cell
                            key={`month-${entry.month}`}
                            fill={
                              recap.busiestMonth && entry.month === recap.busiestMonth.month
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
