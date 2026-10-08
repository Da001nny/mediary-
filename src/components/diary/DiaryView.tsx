"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  X,
  UserCheck,
  Users,
  ArrowUpDown,
  Filter,
  Plus,
  BookMarked,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MediaSearchModal } from "@/components/media/MediaSearchModal";
import { SpoilerReviewText } from "@/components/media/SpoilerReviewText";
import { RatingBadge } from "@/components/ui/RatingBadge";
import type { CastMember, CrewMember } from "@/types/database.types";

export interface DiaryEntry {
  id: string;
  media_id: string;
  title: string;
  type: "movie" | "tv" | "book" | "game";
  cover_url: string | null;
  release_year?: number | null;
  genres?: string[];
  status: "completed" | "in_progress" | "planned" | "dropped";
  rating?: number | null;
  progress?: Record<string, unknown> | null;
  notes?: string;
  review?: string;
  contains_spoilers?: boolean;
  logged_at: string;
  cast?: CastMember[];
  crew?: CrewMember[];
}

const DEFAULT_SAMPLE_ENTRIES: DiaryEntry[] = [
  {
    id: "log-1",
    media_id: "movie-550",
    title: "Fight Club",
    type: "movie",
    cover_url: "https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    release_year: 1999,
    genres: ["Drama", "Thriller"],
    status: "completed",
    rating: 90,
    notes:
      "A masterpiece of nihilistic satire and psychological tension. Brad Pitt and Edward Norton have unmatched chemistry under Fincher's kinetic direction.",
    logged_at: "2026-09-24T18:30:00Z",
    cast: [
      { id: 819, name: "Edward Norton", character: "The Narrator" },
      { id: 287, name: "Brad Pitt", character: "Tyler Durden" },
      { id: 1283, name: "Helena Bonham Carter", character: "Marla Singer" },
    ],
    crew: [{ id: 7467, name: "David Fincher", job: "Director", department: "Directing" }],
  },
  {
    id: "log-2",
    media_id: "movie-157336",
    title: "Interstellar",
    type: "movie",
    cover_url: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    release_year: 2014,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    status: "completed",
    rating: 100,
    notes:
      "The docking scene remains one of the greatest moments in modern cinema. Zimmer's organ score reverberates long after the credits roll.",
    logged_at: "2026-09-22T21:00:00Z",
    cast: [
      { id: 10297, name: "Matthew McConaughey", character: "Cooper" },
      { id: 1813, name: "Anne Hathaway", character: "Brand" },
      { id: 83002, name: "Jessica Chastain", character: "Murph" },
    ],
    crew: [{ id: 525, name: "Christopher Nolan", job: "Director", department: "Directing" }],
  },
  {
    id: "log-3",
    media_id: "tv-95557",
    title: "Severance",
    type: "tv",
    cover_url: "https://image.tmdb.org/t/p/w342/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg",
    release_year: 2022,
    genres: ["Drama", "Mystery", "Sci-Fi"],
    status: "in_progress",
    rating: 90,
    progress: { season: 1, episode: 9 },
    contains_spoilers: true,
    notes:
      "Finished season 1. The waffle party and finale cliffhanger left me breathless. Stellar, unnerving performance by Adam Scott.",
    logged_at: "2026-09-20T14:15:00Z",
    cast: [
      { id: 36801, name: "Adam Scott", character: "Mark Scout" },
      { id: 4587, name: "Patricia Arquette", character: "Harmony Cobel" },
      { id: 3895, name: "John Turturro", character: "Irving" },
      { id: 193, name: "Christopher Walken", character: "Burt" },
    ],
    crew: [{ id: 7399, name: "Ben Stiller", job: "Director", department: "Directing" }],
  },
  {
    id: "log-4",
    media_id: "movie-16869",
    title: "Inglourious Basterds",
    type: "movie",
    cover_url: "https://image.tmdb.org/t/p/w342/7sfbEnaARXDD5Km007MsbY9KiEH.jpg",
    release_year: 2009,
    genres: ["War", "Drama", "Thriller"],
    status: "completed",
    rating: 80,
    notes:
      "Brad Pitt's Lt. Aldo Raine is endlessly quotable. The opening farmhouse scene is a masterclass in suspense.",
    logged_at: "2026-09-18T19:40:00Z",
    cast: [
      { id: 287, name: "Brad Pitt", character: "Lt. Aldo Raine" },
      { id: 27319, name: "Christoph Waltz", character: "Col. Hans Landa" },
      { id: 137427, name: "Michael Fassbender", character: "Lt. Archie Hicox" },
    ],
    crew: [{ id: 138, name: "Quentin Tarantino", job: "Director", department: "Directing" }],
  },
  {
    id: "log-5",
    media_id: "movie-129",
    title: "Spirited Away",
    type: "movie",
    cover_url: "https://image.tmdb.org/t/p/w342/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    release_year: 2001,
    genres: ["Animation", "Family", "Fantasy"],
    status: "completed",
    rating: 100,
    notes:
      "A quiet morning rewatch. Miyazaki's visual imagination and Joe Hisaishi's gentle piano motifs feel like a warm hug.",
    logged_at: "2026-09-15T09:10:00Z",
    cast: [
      { id: 19588, name: "Rumi Hiiragi", character: "Chihiro (voice)" },
      { id: 19589, name: "Miyu Irino", character: "Haku (voice)" },
    ],
    crew: [{ id: 608, name: "Hayao Miyazaki", job: "Director", department: "Directing" }],
  },
];

export function DiaryView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Load person filter from URL params if present
  const personQuery = searchParams.get("person") || "";

  // State
  const [entries] = useState<DiaryEntry[]>(() => {
    if (typeof window === "undefined") return DEFAULT_SAMPLE_ENTRIES;
    try {
      const stored = localStorage.getItem("mediary_diary_entries");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed];
          DEFAULT_SAMPLE_ENTRIES.forEach((d) => {
            if (!merged.some((m) => m.media_id === d.media_id)) {
              merged.push(d);
            }
          });
          return merged;
        }
      }
    } catch {
      // Ignore
    }
    return DEFAULT_SAMPLE_ENTRIES;
  });

  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [manualPersonFilter, setManualPersonFilter] = useState<string | null>(null);

  // personFilter is derived: manual override takes precedence, fallback to URL search param
  const personFilter = manualPersonFilter !== null ? manualPersonFilter : personQuery;

  const [personSearchInput, setPersonSearchInput] = useState<string>("");
  const [showPersonDropdown, setShowPersonDropdown] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "rating_desc" | "title_asc">("date_desc");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Compute all unique performers and crew from the user's logged entries
  const allPeopleInDiary = useMemo(() => {
    const peopleMap = new Map<string, { id: number; name: string; count: number; role: string }>();

    entries.forEach((entry) => {
      // Cast
      if (Array.isArray(entry.cast)) {
        entry.cast.forEach((c) => {
          const key = c.name.toLowerCase();
          const existing = peopleMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            peopleMap.set(key, { id: c.id, name: c.name, count: 1, role: "Actor" });
          }
        });
      }
      // Crew
      if (Array.isArray(entry.crew)) {
        entry.crew.forEach((c) => {
          const key = c.name.toLowerCase();
          const existing = peopleMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            peopleMap.set(key, {
              id: c.id,
              name: c.name,
              count: 1,
              role: c.job || c.department || "Crew",
            });
          }
        });
      }
    });

    return Array.from(peopleMap.values()).sort((a, b) => b.count - a.count);
  }, [entries]);

  // Filtered people suggestions for the dropdown
  const suggestedPeople = useMemo(() => {
    if (!personSearchInput.trim()) return allPeopleInDiary.slice(0, 8);
    const q = personSearchInput.toLowerCase().trim();
    return allPeopleInDiary.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }, [allPeopleInDiary, personSearchInput]);

  // Filter entries based on all active criteria
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Media Type
      if (selectedType !== "all" && entry.type !== selectedType) {
        return false;
      }

      // 2. Status
      if (selectedStatus !== "all" && entry.status !== selectedStatus) {
        return false;
      }

      // 3. Actor / Crew Filter (User Request Feature!)
      if (personFilter.trim()) {
        const pLower = personFilter.toLowerCase().trim();
        const hasActor =
          Array.isArray(entry.cast) &&
          entry.cast.some((c) => c.name.toLowerCase().includes(pLower));
        const hasCrew =
          Array.isArray(entry.crew) &&
          entry.crew.some((c) => c.name.toLowerCase().includes(pLower));

        if (!hasActor && !hasCrew) {
          return false;
        }
      }

      // 4. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = entry.title.toLowerCase().includes(q);
        const matchesNotes = entry.notes?.toLowerCase().includes(q) || false;
        const matchesGenre =
          Array.isArray(entry.genres) &&
          entry.genres.some((g) => g.toLowerCase().includes(q));
        if (!matchesTitle && !matchesNotes && !matchesGenre) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime();
      }
      if (sortBy === "rating_desc") {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [entries, selectedType, selectedStatus, personFilter, searchQuery, sortBy]);

  const clearPersonFilter = () => {
    setManualPersonFilter("");
    setPersonSearchInput("");
    if (personQuery) {
      router.push("/diary");
    }
  };

  const handleSelectPerson = (name: string) => {
    setManualPersonFilter(name);
    setPersonSearchInput("");
    setShowPersonDropdown(false);
  };

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-14">
      {/* 1. Header Banner */}
      <section className="card-depth rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-10 xl:p-12 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-bold font-mono">
              <BookMarked className="w-4 h-4" />
              <span>Personal Media Archive</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-black text-text tracking-tight leading-tight">
              My Media Diary
            </h1>
            <p className="text-xs sm:text-sm text-text-muted max-w-xl leading-relaxed">
              Log, review, and filter your movies, television shows, video games, and books over slow mornings.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsSearchModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Log New Title
            </Button>
          </div>
        </div>

        {/* Quick Stats Row with Subtle Ambient Elevation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-6 pt-5 sm:pt-6 border-t border-border/70">
          <div className="p-3 sm:p-5 rounded-xl bg-surface/70 border border-border/80 card-depth-hover transition-all space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-[11px] text-text-muted uppercase font-mono font-semibold block">
              Total Logged
            </span>
            <p className="font-serif text-xl sm:text-3xl font-bold text-text">
              {entries.length}
            </p>
          </div>
          <div className="p-3 sm:p-5 rounded-xl bg-surface/70 border border-border/80 card-depth-hover transition-all space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-[11px] text-text-muted uppercase font-mono font-semibold block">
              Completed
            </span>
            <p className="font-serif text-xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400">
              {entries.filter((e) => e.status === "completed").length}
            </p>
          </div>
          <div className="p-3 sm:p-5 rounded-xl bg-surface/70 border border-border/80 card-depth-hover transition-all space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-[11px] text-text-muted uppercase font-mono font-semibold block">
              In Progress
            </span>
            <p className="font-serif text-xl sm:text-3xl font-bold text-amber-700 dark:text-amber-400">
              {entries.filter((e) => e.status === "in_progress").length}
            </p>
          </div>
          <div className="p-3 sm:p-5 rounded-xl bg-surface/70 border border-border/80 card-depth-hover transition-all space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-[11px] text-text-muted uppercase font-mono font-semibold block">
              Unique Performers
            </span>
            <p className="font-serif text-xl sm:text-3xl font-bold text-accent">
              {allPeopleInDiary.length}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Comprehensive Filter Toolbar */}
      <section className="card-depth rounded-2xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-accent" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text">
              Filter Your Diary
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>
              Showing <strong>{filteredEntries.length}</strong> of {entries.length} titles
            </span>
          </div>
        </div>

        {/* Primary Filter Rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* A. Actor / Crew Filter (Target feature from prompt!) */}
          <div className="space-y-1 relative">
            <label className="text-[11px] font-semibold text-text uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent" />
                <span>Actor / Crew Filter</span>
              </span>
              {personFilter && (
                <button
                  type="button"
                  onClick={clearPersonFilter}
                  className="text-text-muted hover:text-red-500 text-[10px] lowercase cursor-pointer"
                >
                  (clear)
                </button>
              )}
            </label>

            {personFilter ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/15 border border-accent/35 text-xs text-accent font-semibold shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">Featuring: {personFilter}</span>
                </div>
                <button
                  type="button"
                  onClick={clearPersonFilter}
                  className="p-1 rounded hover:bg-accent/20 cursor-pointer ml-1"
                  title="Clear person filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by actor or director..."
                  value={personSearchInput}
                  onChange={(e) => {
                    setPersonSearchInput(e.target.value);
                    setShowPersonDropdown(true);
                  }}
                  onFocus={() => setShowPersonDropdown(true)}
                  className="w-full h-9 bg-bg border border-border rounded-lg pl-8 pr-3 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent shadow-2xs"
                />
                <Users className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />

                {/* Autocomplete / Suggested People Dropdown */}
                {showPersonDropdown && suggestedPeople.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-30 max-h-56 overflow-y-auto py-1 animate-in fade-in-50 zoom-in-95">
                    <div className="px-3 py-1 text-[10px] uppercase font-mono text-text-muted border-b border-border/60">
                      Logged Performers & Directors
                    </div>
                    {suggestedPeople.map((person) => (
                      <button
                        key={`${person.id}-${person.name}`}
                        type="button"
                        onClick={() => handleSelectPerson(person.name)}
                        className="w-full px-3 py-2 text-left flex items-center justify-between text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <span className="font-medium truncate">{person.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-text-muted font-mono">
                          <span>{person.role}</span>
                          <span className="bg-bg px-1.5 py-0.2 rounded border border-border">
                            {person.count}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* B. Media Type Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text uppercase tracking-wider">
              Media Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-9 bg-bg border border-border rounded-lg px-3 text-xs text-text focus:outline-none focus:border-accent shadow-2xs cursor-pointer"
            >
              <option value="all">All Media Types</option>
              <option value="movie">Feature Films (Movies)</option>
              <option value="tv">Television Series</option>
              <option value="book">Books & Literature</option>
              <option value="game">Video Games</option>
            </select>
          </div>

          {/* C. Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text uppercase tracking-wider">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 bg-bg border border-border rounded-lg px-3 text-xs text-text focus:outline-none focus:border-accent shadow-2xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed / Finished</option>
              <option value="in_progress">In Progress / Watching</option>
              <option value="planned">Planned / Want to Watch</option>
              <option value="dropped">Dropped / Paused</option>
            </select>
          </div>

          {/* D. Sort Order */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-text-muted" />
              <span>Sort By</span>
            </label>
            <select
              value={sortBy}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-9 bg-bg border border-border rounded-lg px-3 text-xs text-text focus:outline-none focus:border-accent shadow-2xs cursor-pointer"
            >
              <option value="date_desc">Logged Date (Newest First)</option>
              <option value="date_asc">Logged Date (Oldest First)</option>
              <option value="rating_desc">Highest User Rating</option>
              <option value="title_asc">Title (Alphabetical A-Z)</option>
            </select>
          </div>
        </div>

        {/* Text Search Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/50">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search title, thoughts, or genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-bg border border-border rounded-lg pl-8 pr-3 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-[10px] text-text-muted hover:text-text cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
            {personFilter && (
              <Badge variant="amber" size="sm" className="gap-1 text-[10px] sm:text-xs">
                <span>Actor: {personFilter}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={clearPersonFilter} />
              </Badge>
            )}
            {selectedType !== "all" && (
              <Badge variant="subtle" size="sm" className="gap-1 capitalize text-[10px] sm:text-xs">
                <span>Type: {selectedType}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedType("all")} />
              </Badge>
            )}
            {selectedStatus !== "all" && (
              <Badge variant="subtle" size="sm" className="gap-1 capitalize text-[10px] sm:text-xs">
                <span>Status: {selectedStatus.replace("_", " ")}</span>
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedStatus("all")} />
              </Badge>
            )}
            {(personFilter || selectedType !== "all" || selectedStatus !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  clearPersonFilter();
                  setSelectedType("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                }}
                className="text-xs text-accent hover:underline font-medium cursor-pointer ml-1"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Logged Entries Feed / Grid */}
      <section className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-dashed border-border p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent/15 text-accent mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-text">
                No diary entries match your filters
              </h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                {personFilter
                  ? `You haven't logged any titles featuring "${personFilter}" yet.`
                  : "Try clearing your type, status, or search filters to see all logged titles."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  clearPersonFilter();
                  setSelectedType("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSearchModalOpen(true)}
              >
                Discover Titles on TMDB
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {filteredEntries.map((entry) => {
              const formattedDate = new Date(entry.logged_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl card-depth card-depth-hover transition-all flex flex-col justify-between overflow-hidden p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5"
                >
                  <div className="space-y-3.5 sm:space-y-4">
                    {/* Header Row: Poster + Title + Rating */}
                    <div className="flex gap-3 sm:gap-5 items-start">
                      {/* Cover Poster with Physical Object Drop Shadow & Lift */}
                      <Link
                        href={`/media/${entry.media_id}`}
                        className="relative w-20 sm:w-28 md:w-32 aspect-2/3 rounded-xl overflow-hidden poster-depth ring-1 ring-black/10 dark:ring-white/10 shrink-0 group block bg-bg"
                      >
                        {entry.cover_url ? (
                          <Image
                            src={entry.cover_url}
                            alt={entry.title}
                            fill
                            sizes="(max-width: 640px) 80px, 128px"
                            className="object-cover group-hover:scale-106 transition-transform duration-500 ease-out"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-xs text-text-muted bg-surface font-serif font-bold">
                            {entry.title}
                          </div>
                        )}
                      </Link>

                      {/* Title & Metadata */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2.5">
                          <Link
                            href={`/media/${entry.media_id}`}
                            className="font-serif text-lg sm:text-xl font-bold text-text hover:text-accent transition-colors line-clamp-1"
                          >
                            {entry.title}
                          </Link>

                          {entry.rating !== null && entry.rating !== undefined && (
                            <RatingBadge rating={entry.rating} size="sm" className="shrink-0" />
                          )}
                        </div>

                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="subtle" size="sm" className="capitalize text-[10px]">
                            {entry.type}
                          </Badge>

                          <Badge
                            variant={entry.status === "completed" ? "forest" : "amber"}
                            size="sm"
                            className="capitalize text-[10px]"
                            dot
                            dotColor={entry.status === "completed" ? "forest" : "amber"}
                          >
                            {entry.status.replace("_", " ")}
                          </Badge>

                          {entry.progress && (
                            (() => {
                              const p = entry.progress as Record<string, unknown>;
                              if (entry.type === "tv" && (p.season != null || p.episode != null)) {
                                return (
                                  <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
                                    {p.season != null ? `S${p.season}` : ""}
                                    {p.season != null && p.episode != null ? " · " : ""}
                                    {p.episode != null ? `Ep ${p.episode}` : ""}
                                  </Badge>
                                );
                              }
                              if (entry.type === "game" && (p.hoursPlayed != null || p.completionPct != null || p.platform != null)) {
                                return (
                                  <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
                                    {p.hoursPlayed != null ? `${p.hoursPlayed}h` : ""}
                                    {p.hoursPlayed != null && p.completionPct != null ? " · " : ""}
                                    {p.completionPct != null ? `${p.completionPct}%` : ""}
                                    {p.platform ? ` · ${String(p.platform)}` : ""}
                                  </Badge>
                                );
                              }
                              if (entry.type === "book" && p.pagesRead != null) {
                                return (
                                  <Badge variant="subtle" size="sm" className="font-mono text-[10px]">
                                    p. {String(p.pagesRead)}
                                  </Badge>
                                );
                              }
                              return null;
                            })()
                          )}

                          {entry.release_year && (
                            <span className="text-xs font-mono text-text-muted">
                              {entry.release_year}
                            </span>
                          )}
                        </div>

                        {/* Logged Date */}
                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted pt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-accent" />
                          <span>Logged on {formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Review Notes in padded card */}
                    {(entry.notes || entry.review) && (
                      <div className="p-3.5 sm:p-4 rounded-xl bg-bg/50 border border-border/70 text-xs sm:text-sm leading-relaxed">
                        <SpoilerReviewText
                          text={entry.notes || entry.review || ""}
                          containsSpoilers={Boolean(
                            entry.contains_spoilers ||
                            (entry.progress as Record<string, unknown>)?.contains_spoilers
                          )}
                          isAuthor={true}
                        />
                      </div>
                    )}

                    {/* Cast & Crew Chips (Allows filtering right from entry!) */}
                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Cast & Crew · Click to filter diary
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.cast?.slice(0, 3).map((c) => {
                          const isCurrentFilter =
                            personFilter.toLowerCase().trim() === c.name.toLowerCase().trim();
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectPerson(c.name)}
                              className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer border ${
                                isCurrentFilter
                                  ? "bg-accent text-[#0E0902] dark:text-[#0A0702] border-amber-950/20 font-semibold"
                                  : "bg-surface hover:bg-surface-hover text-text border-border"
                              }`}
                              title={`Filter diary to ${c.name}`}
                            >
                              {c.name} {c.character ? `(${c.character})` : ""}
                            </button>
                          );
                        })}

                        {entry.crew?.slice(0, 2).map((c) => {
                          const isCurrentFilter =
                            personFilter.toLowerCase().trim() === c.name.toLowerCase().trim();
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectPerson(c.name)}
                              className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer border ${
                                isCurrentFilter
                                  ? "bg-accent-secondary text-white border-accent-secondary font-semibold"
                                  : "bg-surface hover:bg-surface-hover text-accent-secondary border-accent-secondary/30"
                              }`}
                              title={`Filter diary to ${c.name}`}
                            >
                              {c.name} ({c.job || "Director"})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* TMDB Search Modal for adding new items */}
      <MediaSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
}
