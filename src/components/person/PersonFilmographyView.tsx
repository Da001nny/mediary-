"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Film,
  Tv,
  Star,
  Calendar,
  MapPin,
  ArrowLeft,
  BookMarked,
  Search,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import type { TMDBPersonDetails, TMDBPersonCredit } from "@/lib/tmdb";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface PersonFilmographyViewProps {
  person: TMDBPersonDetails;
}

export function PersonFilmographyView({ person }: PersonFilmographyViewProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "movie" | "tv" | "crew">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [bioExpanded, setBioExpanded] = useState(false);

  const castCredits = useMemo(
    () => person.combined_credits?.cast || [],
    [person.combined_credits?.cast]
  );
  const crewCredits = useMemo(
    () => person.combined_credits?.crew || [],
    [person.combined_credits?.crew]
  );

  // Filter credits based on active tab and search query
  const filteredCredits = useMemo(() => {
    let list: TMDBPersonCredit[] = [];
    if (activeFilter === "crew") {
      list = crewCredits;
    } else if (activeFilter === "movie") {
      list = castCredits.filter((c) => c.type === "movie");
    } else if (activeFilter === "tv") {
      list = castCredits.filter((c) => c.type === "tv");
    } else {
      // "all" - combine cast and crew, deduplicate by type+id
      const map = new Map<string, TMDBPersonCredit>();
      [...castCredits, ...crewCredits].forEach((c) => {
        const key = `${c.type}-${c.id}`;
        if (!map.has(key)) {
          map.set(key, c);
        }
      });
      list = Array.from(map.values());
    }

    // Sort by release date / year descending
    list.sort((a, b) => (b.year || 0) - (a.year || 0));

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.character && c.character.toLowerCase().includes(q)) ||
        (c.job && c.job.toLowerCase().includes(q))
    );
  }, [castCredits, crewCredits, activeFilter, searchQuery]);

  // Compute birth year / age if birthday available
  const age = useMemo(() => {
    if (!person.birthday) return null;
    const birth = new Date(person.birthday);
    const end = person.deathday ? new Date(person.deathday) : new Date();
    const diff = end.getFullYear() - birth.getFullYear();
    return diff > 0 ? diff : null;
  }, [person.birthday, person.deathday]);

  const formattedBirthday = person.birthday
    ? new Date(person.birthday).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Header / Biographical Banner */}
      <section className="bg-surface rounded-2xl border border-border p-4 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between pb-4 sm:pb-6 border-b border-border/70 flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to Catalog</span>
          </Link>

          {/* Quick link to diary filtered by this person */}
          <Link href={`/diary?person=${encodeURIComponent(person.name)}`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              leftIcon={<BookMarked className="w-3.5 h-3.5 text-accent" />}
            >
              <span>Filter in My Diary</span>
            </Button>
          </Link>
        </div>

        <div className="pt-6 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
          {/* Profile Photo */}
          <div className="relative w-36 sm:w-44 aspect-3/4 rounded-xl overflow-hidden bg-bg border border-border shadow-md shrink-0 mx-auto md:mx-0">
            {person.profile_url ? (
              <Image
                src={person.profile_url}
                alt={person.name}
                fill
                priority
                sizes="(max-width: 640px) 144px, 176px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-surface text-text-muted">
                <div className="w-14 h-14 rounded-full bg-accent/15 text-accent flex items-center justify-center font-serif text-xl font-bold mb-2">
                  {person.name.charAt(0)}
                </div>
                <span className="text-xs">No Photo</span>
              </div>
            )}
          </div>

          {/* Details & Biography */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge variant="amber" size="sm">
                  {person.known_for_department || "Acting"}
                </Badge>
                {person.deathday && (
                  <Badge variant="subtle" size="sm">
                    Deceased
                  </Badge>
                )}
                {person.isMock && (
                  <Badge variant="subtle" size="sm" className="text-[10px]">
                    Preview Profile
                  </Badge>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text tracking-tight">
                {person.name}
              </h1>

              {/* Vitals row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted mt-2">
                {formattedBirthday && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>
                      Born {formattedBirthday} {age ? `(age ${age})` : ""}
                    </span>
                  </div>
                )}

                {person.place_of_birth && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent-secondary" />
                    <span>{person.place_of_birth}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-text-muted" />
                  <span>
                    {castCredits.length} Acting · {crewCredits.length} Production credits
                  </span>
                </div>
              </div>
            </div>

            {/* Biography */}
            {person.biography ? (
              <div className="space-y-1.5 pt-1">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Biography
                </h3>
                <p
                  className={`text-sm text-text/90 font-sans leading-relaxed ${
                    !bioExpanded ? "line-clamp-4" : ""
                  }`}
                >
                  {person.biography}
                </p>
                {person.biography.length > 280 && (
                  <button
                    type="button"
                    onClick={() => setBioExpanded(!bioExpanded)}
                    className="text-xs text-accent hover:underline font-medium cursor-pointer"
                  >
                    {bioExpanded ? "Show less" : "Read full biography"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. Known For Highlights (if any) */}
      {person.known_for && person.known_for.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="font-serif text-xl font-bold text-text">
              Known For
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {person.known_for.slice(0, 6).map((item) => (
              <Link
                key={`known-${item.type}-${item.id}`}
                href={`/media/${item.type}-${item.id}`}
                className="group flex flex-col bg-surface border border-border rounded-lg overflow-hidden hover:border-accent hover:shadow-xs transition-all"
              >
                <div className="relative aspect-2/3 w-full bg-bg overflow-hidden">
                  {item.poster_url ? (
                    <Image
                      src={item.poster_url}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover group-hover:scale-104 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-text-muted">
                      No poster
                    </div>
                  )}
                  {item.vote_average > 0 && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-bg/85 backdrop-blur-xs text-[10px] font-bold text-text flex items-center gap-1 shadow-2xs">
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      <span>{item.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-0.5">
                  <h4 className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-text-muted truncate">
                    {item.character || item.job || (item.year ? String(item.year) : "Film")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Complete Filmography Directory */}
      <section className="bg-surface rounded-2xl border border-border p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
        {/* Controls Bar: Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-border/70">
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
              Filmography
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Showing {filteredCredits.length} titles · Click any entry to open its title page
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center p-1 bg-bg border border-border rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-surface text-text font-semibold shadow-2xs"
                    : "text-text-muted hover:text-text"
                }`}
              >
                All ({castCredits.length + crewCredits.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("movie")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === "movie"
                    ? "bg-surface text-text font-semibold shadow-2xs"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Movies
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("tv")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === "tv"
                    ? "bg-surface text-text font-semibold shadow-2xs"
                    : "text-text-muted hover:text-text"
                }`}
              >
                TV Shows
              </button>
              {crewCredits.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("crew")}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    activeFilter === "crew"
                      ? "bg-surface text-text font-semibold shadow-2xs"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Crew ({crewCredits.length})
                </button>
              )}
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="Search credits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent shadow-2xs"
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
          </div>
        </div>

        {/* Filmography Cards Grid */}
        {filteredCredits.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-xs bg-bg/40 rounded-lg border border-dashed border-border/80">
            No credits found matching your filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {filteredCredits.map((item, index) => (
              <Link
                key={`${item.type}-${item.id}-${index}`}
                href={`/media/${item.type}-${item.id}`}
                className="group flex flex-col bg-bg border border-border rounded-lg overflow-hidden hover:border-accent hover:shadow-xs transition-all"
              >
                <div className="relative aspect-2/3 w-full bg-surface shrink-0 overflow-hidden">
                  {item.poster_url ? (
                    <Image
                      src={item.poster_url}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover group-hover:scale-104 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-text-muted">
                      {item.type === "movie" ? (
                        <Film className="w-5 h-5 opacity-40 mb-1" />
                      ) : (
                        <Tv className="w-5 h-5 opacity-40 mb-1" />
                      )}
                      <span className="text-[10px] leading-tight line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}

                  <div className="absolute top-1.5 left-1.5">
                    <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-bg/85 backdrop-blur-xs text-text border border-border/60">
                      {item.type}
                    </span>
                  </div>

                  {item.vote_average > 0 && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-bg/85 backdrop-blur-xs text-[10px] font-bold text-text flex items-center gap-1 shadow-2xs">
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      <span>{item.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 flex flex-col justify-between flex-1 space-y-1">
                  <div>
                    <h4 className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                      {item.title}
                    </h4>
                    {item.character && (
                      <p
                        className="text-[11px] text-text-muted truncate"
                        title={item.character}
                      >
                        as {item.character}
                      </p>
                    )}
                    {item.job && (
                      <p className="text-[11px] text-accent font-medium truncate">
                        {item.job}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-1 border-t border-border/50">
                    <span>{item.year || "—"}</span>
                    <span className="text-accent group-hover:underline inline-flex items-center gap-0.5">
                      View Title
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
