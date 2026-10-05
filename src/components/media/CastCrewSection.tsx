"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Users, Clapperboard, Search, ChevronDown } from "lucide-react";
import type { CastMember, CrewMember } from "@/types/database.types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CastCrewSectionProps {
  cast: CastMember[];
  crew: CrewMember[];
}

export function CastCrewSection({ cast = [], crew = [] }: CastCrewSectionProps) {
  // Collapsed by default as requested
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"cast" | "crew">("cast");
  const [searchQuery, setSearchQuery] = useState("");

  // Group crew by department
  const crewByDepartment = useMemo(() => {
    const map = new Map<string, CrewMember[]>();
    crew.forEach((c) => {
      const dept = c.department || "Production";
      if (!map.has(dept)) {
        map.set(dept, []);
      }
      map.get(dept)!.push(c);
    });
    return map;
  }, [crew]);

  // Real-time filtering of cast as user types
  const filteredCast = useMemo(() => {
    if (!searchQuery.trim()) return cast;
    const q = searchQuery.toLowerCase().trim();
    return cast.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.character && c.character.toLowerCase().includes(q))
    );
  }, [cast, searchQuery]);

  // Real-time filtering of crew as user types
  const filteredCrew = useMemo(() => {
    if (!searchQuery.trim()) return crew;
    const q = searchQuery.toLowerCase().trim();
    return crew.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.job && c.job.toLowerCase().includes(q)) ||
        (c.department && c.department.toLowerCase().includes(q))
    );
  }, [crew, searchQuery]);

  // Preview cast (top 6) for collapsed summary row
  const previewCast = useMemo(() => {
    return cast.slice(0, 6);
  }, [cast]);

  const totalCreditsCount = cast.length + crew.length;

  return (
    <section className="card-depth rounded-2xl overflow-hidden transition-all">
      {/* Collapsible Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 sm:p-8 lg:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 cursor-pointer hover:bg-surface-hover/40 transition-colors select-none group"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center shrink-0 shadow-2xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-text group-hover:text-accent transition-colors">
                Cast & Crew
              </h2>
              <Badge variant="subtle" size="sm" className="font-mono text-xs">
                {totalCreditsCount} credits ({cast.length} cast, {crew.length} crew)
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
              Performers, directors, writers, and technical creators · Click any person to explore filmography
            </p>
          </div>
        </div>

        {/* Collapsed Preview & Expand Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Cast Thumbnails Row Preview when collapsed */}
          {!isExpanded && previewCast.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center -space-x-2">
                {previewCast.map((member) => {
                  const photoUrl = member.profile_path
                    ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
                    : null;

                  return (
                    <Link
                      key={member.id}
                      href={`/person/${member.id}`}
                      title={`${member.name}${member.character ? ` as ${member.character}` : ""}`}
                      className="relative w-8 h-8 rounded-full overflow-hidden bg-bg border-2 border-surface hover:border-accent hover:scale-110 hover:z-10 transition-all shadow-2xs shrink-0 block"
                    >
                      {photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt={member.name}
                          fill
                          sizes="32px"
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-accent/20 text-accent text-[10px] font-bold font-serif">
                          {member.name.charAt(0)}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {cast.length > previewCast.length && (
                <span className="text-[11px] font-mono text-text-muted">
                  +{cast.length - previewCast.length} more
                </span>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs gap-1.5 shrink-0 pointer-events-none group-hover:border-accent/40"
            rightIcon={
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-text-muted transition-transform duration-300",
                  isExpanded && "rotate-180 text-accent"
                )}
              />
            }
          >
            {isExpanded ? "Collapse" : "View Directory"}
          </Button>
        </div>
      </div>

      {/* Expanded Animated Content (deliberate motion moment) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="cast-crew-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-6 sm:p-8 lg:p-10 space-y-8">
              {/* Tab Switcher & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
                {/* Segmented Tab Control */}
                <div className="flex items-center p-1 bg-bg border border-border rounded-lg text-xs font-medium self-start">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("cast");
                      setSearchQuery("");
                    }}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      activeTab === "cast"
                        ? "bg-surface text-text shadow-2xs font-semibold"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    Cast ({cast.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("crew");
                      setSearchQuery("");
                    }}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      activeTab === "crew"
                        ? "bg-surface text-text shadow-2xs font-semibold"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    Crew ({crew.length})
                  </button>
                </div>

                {/* Real-Time Filter Search Input */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder={
                      activeTab === "cast"
                        ? "Find actor or character..."
                        : "Find director, writer, crew..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/25 transition-colors shadow-2xs"
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

              {/* Notice that names are clickable */}
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>
                  Tip: Click any actor or crew member to view their complete TMDB filmography.
                </span>
                {searchQuery && (
                  <span className="font-mono text-accent">
                    Matching &ldquo;{searchQuery}&rdquo;:{" "}
                    {activeTab === "cast" ? filteredCast.length : filteredCrew.length} results
                  </span>
                )}
              </div>

              {/* Tab 1: Cast */}
              {activeTab === "cast" ? (
                <div>
                  {filteredCast.length === 0 ? (
                    <div className="py-12 text-center text-text-muted text-xs bg-bg/40 rounded-lg border border-dashed border-border/80">
                      {searchQuery
                        ? `No cast members found matching "${searchQuery}".`
                        : "No cast credits recorded for this title."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                      {filteredCast.map((member) => (
                        <CastCard
                          key={`${member.id}-${member.order ?? member.name}`}
                          member={member}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 2: Crew */
                <div>
                  {filteredCrew.length === 0 ? (
                    <div className="py-12 text-center text-text-muted text-xs bg-bg/40 rounded-lg border border-dashed border-border/80">
                      {searchQuery
                        ? `No crew members found matching "${searchQuery}".`
                        : "No crew credits recorded for this title."}
                    </div>
                  ) : searchQuery.trim() ? (
                    /* Flat list when searching */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredCrew.map((c, idx) => (
                        <CrewCard key={`${c.id}-${c.job}-${idx}`} member={c} />
                      ))}
                    </div>
                  ) : (
                    /* Grouped by department when not searching */
                    <div className="space-y-6">
                      {Array.from(crewByDepartment.entries()).map(([dept, members]) => (
                        <div key={dept} className="space-y-2.5">
                          <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
                            <Clapperboard className="w-3.5 h-3.5 text-accent" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                              {dept}
                            </h3>
                            <span className="text-[11px] font-mono text-text-muted">
                              ({members.length})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {members.map((c, idx) => (
                              <CrewCard key={`${c.id}-${c.job}-${idx}`} member={c} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CastCard({ member }: { member: CastMember }) {
  const photoUrl = member.profile_path
    ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
    : null;

  return (
    <Link
      href={`/person/${member.id}`}
      className="flex flex-col card-depth rounded-2xl overflow-hidden group card-depth-hover transition-all duration-300 cursor-pointer"
    >
      <div className="relative aspect-3/4 w-full bg-surface shrink-0 overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={member.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-surface text-text-muted">
            <div className="w-11 h-11 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-bold font-serif mb-1.5 shadow-2xs">
              {member.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <span className="text-[11px] opacity-60 font-sans">No Photo</span>
          </div>
        )}
      </div>

      <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 min-w-0 space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-text truncate group-hover:text-accent transition-colors font-serif">
          {member.name}
        </h4>
        {member.character && (
          <p
            className="text-xs text-text-muted truncate leading-tight"
            title={member.character}
          >
            {member.character}
          </p>
        )}
      </div>
    </Link>
  );
}

function CrewCard({ member }: { member: CrewMember }) {
  const photoUrl = member.profile_path
    ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
    : null;

  return (
    <Link
      href={`/person/${member.id}`}
      className="flex items-center gap-3.5 p-3.5 rounded-2xl card-depth group card-depth-hover transition-all duration-300 cursor-pointer"
    >
      <div className="relative w-12 h-15 rounded-xl overflow-hidden bg-bg shrink-0 poster-depth-sm ring-1 ring-black/10 dark:ring-white/10">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={member.name}
            fill
            sizes="48px"
            className="object-cover group-hover:scale-106 transition-transform duration-500 ease-out"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface text-text-muted font-serif text-sm font-bold">
            {member.name[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h4 className="text-xs sm:text-sm font-bold text-text truncate group-hover:text-accent transition-colors font-serif">
          {member.name}
        </h4>
        <p className="text-xs text-text-muted truncate">
          {member.job || member.department}
        </p>
      </div>
    </Link>
  );
}
