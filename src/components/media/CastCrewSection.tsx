"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { Users, Clapperboard, Search } from "lucide-react";
import type { CastMember, CrewMember } from "@/types/database.types";

interface CastCrewSectionProps {
  cast: CastMember[];
  crew: CrewMember[];
}

export function CastCrewSection({ cast = [], crew = [] }: CastCrewSectionProps) {
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

  const filteredCast = useMemo(() => {
    if (!searchQuery.trim()) return cast;
    const q = searchQuery.toLowerCase();
    return cast.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.character && c.character.toLowerCase().includes(q))
    );
  }, [cast, searchQuery]);

  const filteredCrew = useMemo(() => {
    if (!searchQuery.trim()) return crew;
    const q = searchQuery.toLowerCase();
    return crew.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.job && c.job.toLowerCase().includes(q)) ||
        (c.department && c.department.toLowerCase().includes(q))
    );
  }, [crew, searchQuery]);

  return (
    <section className="bg-surface rounded-xl border border-border p-6 shadow-sm">
      {/* Header with Switcher & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            <h2 className="font-serif text-xl font-bold text-text">
              Cast & Crew
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Performers, directors, writers, and technical creators
          </p>
        </div>

        {/* Tab & Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Tab Control */}
          <div className="flex items-center p-1 bg-bg border border-border rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab("cast");
                setSearchQuery("");
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === "cast"
                  ? "bg-surface text-text shadow-xs font-semibold"
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
                  ? "bg-surface text-text shadow-xs font-semibold"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Crew ({crew.length})
            </button>
          </div>

          {/* Quick Search inside Credits */}
          {(cast.length > 8 || crew.length > 8) && (
            <div className="relative">
              <input
                type="text"
                placeholder={activeTab === "cast" ? "Find actor..." : "Find crew member..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 sm:w-44 bg-bg border border-border rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
              />
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2 top-2.5 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-6">
        {activeTab === "cast" ? (
          <div>
            {filteredCast.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs">
                {searchQuery
                  ? `No cast members found matching "${searchQuery}".`
                  : "No cast credits recorded for this title."}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredCast.map((member) => (
                  <CastCard key={`${member.id}-${member.order ?? member.name}`} member={member} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {filteredCrew.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs">
                {searchQuery
                  ? `No crew members found matching "${searchQuery}".`
                  : "No crew credits recorded for this title."}
              </div>
            ) : searchQuery.trim() ? (
              /* Flat list if searching */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredCrew.map((c, idx) => (
                  <CrewCard key={`${c.id}-${c.job}-${idx}`} member={c} />
                ))}
              </div>
            ) : (
              /* Grouped by department */
              <div className="space-y-6">
                {Array.from(crewByDepartment.entries()).map(([dept, members]) => (
                  <div key={dept} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
                      <Clapperboard className="w-3.5 h-3.5 text-accent" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                        {dept}
                      </h3>
                      <span className="text-[11px] text-text-muted">
                        ({members.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
    </section>
  );
}

function CastCard({ member }: { member: CastMember }) {
  const photoUrl = member.profile_path
    ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
    : null;

  return (
    <div className="flex flex-col bg-bg border border-border rounded-lg overflow-hidden group hover:border-accent/40 transition-colors">
      <div className="relative aspect-3/4 w-full bg-surface shrink-0 overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={member.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover group-hover:scale-103 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-surface text-text-muted">
            <div className="w-10 h-10 rounded-full bg-border/60 flex items-center justify-center text-xs font-bold font-serif mb-1">
              {member.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <span className="text-[10px] opacity-60">No Photo</span>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col justify-between flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
          {member.name}
        </h4>
        {member.character && (
          <p className="text-[11px] text-text-muted truncate mt-0.5" title={member.character}>
            {member.character}
          </p>
        )}
      </div>
    </div>
  );
}

function CrewCard({ member }: { member: CrewMember }) {
  const photoUrl = member.profile_path
    ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
    : null;

  return (
    <div className="flex items-center gap-3 p-2.5 bg-bg border border-border rounded-lg hover:border-accent/40 transition-colors group">
      <div className="relative w-11 h-11 rounded-md overflow-hidden bg-surface shrink-0 border border-border/50">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={member.name}
            fill
            sizes="44px"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold font-serif text-text-muted">
            {member.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
          {member.name}
        </h4>
        <p className="text-[10px] text-accent font-medium truncate mt-0.5">
          {member.job || member.department || "Crew"}
        </p>
      </div>
    </div>
  );
}
