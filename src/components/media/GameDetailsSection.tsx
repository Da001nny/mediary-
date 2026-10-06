"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Gamepad2,
  Building2,
  Briefcase,
  Monitor,
  Trophy,
  ShieldAlert,
  Clock,
  ExternalLink,
  ChevronDown,
  Layers,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/database.types";

interface GameDetailsSectionProps {
  media: MediaItem;
}

export function GameDetailsSection({ media }: GameDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  const typeSpecific = (media.type_specific as Record<string, unknown>) || {};
  const platforms = (Array.isArray(typeSpecific.platforms)
    ? typeSpecific.platforms
    : []) as string[];
  const developers = (Array.isArray(typeSpecific.developers)
    ? typeSpecific.developers
    : typeSpecific.developer
    ? [String(typeSpecific.developer)]
    : []) as string[];
  const publishers = (Array.isArray(typeSpecific.publishers)
    ? typeSpecific.publishers
    : typeSpecific.publisher
    ? [String(typeSpecific.publisher)]
    : []) as string[];
  const screenshots = (Array.isArray(typeSpecific.screenshots)
    ? typeSpecific.screenshots
    : []) as string[];
  const metacritic =
    typeof typeSpecific.metacritic === "number" ? typeSpecific.metacritic : null;
  const esrbRating =
    typeof typeSpecific.esrb_rating === "string" ? typeSpecific.esrb_rating : null;
  const website =
    typeof typeSpecific.website === "string" ? typeSpecific.website : null;
  const playtime =
    typeof typeSpecific.playtime === "number" && typeSpecific.playtime > 0
      ? typeSpecific.playtime
      : null;
  const platformPlayedOn =
    typeof typeSpecific.platform_played_on === "string"
      ? typeSpecific.platform_played_on
      : null;

  const getMetacriticColor = (score: number) => {
    if (score >= 75) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (score >= 50) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
  };

  return (
    <section className="card-depth rounded-2xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-8 lg:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-b border-border/70 bg-surface/50">
        <div className="flex items-center gap-3.5 sm:gap-5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0 shadow-2xs">
            <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="font-serif text-xl sm:text-3xl font-extrabold text-text">
                Game Specs & Platforms
              </h2>
              <Badge variant="subtle" size="sm" className="font-mono text-[10px] sm:text-xs">
                Video Game
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 sm:mt-1 leading-relaxed">
              Available platforms, developer studios, and gameplay details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-auto flex-wrap">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-bg/80 hover:bg-bg border border-border transition-colors shadow-2xs"
            >
              <span>Official Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <span>{isExpanded ? "Collapse" : "Expand"}</span>
            <ChevronDown
              className={cn("w-4 h-4 transition-transform duration-200", {
                "rotate-180": isExpanded,
              })}
            />
          </Button>
        </div>
      </div>

      {/* Main Content Body */}
      {isExpanded && (
        <div className="p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8">
          {/* Key Specs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-5">
            {/* Metacritic */}
            {metacritic !== null ? (
              <div className="p-4 sm:p-5 rounded-2xl card-depth flex flex-col justify-between space-y-2 card-depth-hover">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
                  <Trophy className="w-3.5 h-3.5 text-accent" />
                  <span>Metacritic</span>
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-lg text-base font-black border font-mono",
                      getMetacriticColor(metacritic)
                    )}
                  >
                    {metacritic}
                  </span>
                  <span className="text-xs text-text-muted">/ 100</span>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl card-depth flex flex-col justify-between space-y-2 card-depth-hover">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
                  <Trophy className="w-3.5 h-3.5 text-text-muted" />
                  <span>Rating</span>
                </span>
                <div>
                  <span className="text-xs text-text-muted">Not rated</span>
                </div>
              </div>
            )}

            {/* ESRB Rating */}
            <div className="p-4 sm:p-5 rounded-2xl card-depth flex flex-col justify-between space-y-2 card-depth-hover">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
                <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                <span>Age Rating</span>
              </span>
              <div>
                <span className="text-xs sm:text-sm font-bold text-text font-serif">
                  {esrbRating || "Rating Pending"}
                </span>
              </div>
            </div>

            {/* Average Playtime */}
            <div className="p-4 sm:p-5 rounded-2xl card-depth flex flex-col justify-between space-y-2 card-depth-hover">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>Avg. Playtime</span>
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-text font-serif">
                  {playtime ? `~${playtime}` : "Varied"}
                </span>
                {playtime && <span className="text-xs text-text-muted">hours</span>}
              </div>
            </div>

            {/* Genres */}
            <div className="p-4 sm:p-5 rounded-2xl card-depth flex flex-col justify-between space-y-2 card-depth-hover">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Primary Genre</span>
              </span>
              <div>
                <span className="text-xs sm:text-sm font-bold text-text truncate block font-serif">
                  {media.genres?.[0] || String(typeSpecific.genre || "Action")}
                </span>
              </div>
            </div>
          </div>

          {/* Platforms & Studios Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Platforms Card */}
            <div className="p-6 sm:p-7 rounded-2xl card-depth space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-accent" />
                  <span>Available Platforms ({platforms.length})</span>
                </h3>
                {platformPlayedOn && (
                  <Badge variant="subtle" size="sm" className="text-xs font-mono">
                    Played on {platformPlayedOn}
                  </Badge>
                )}
              </div>

              {platforms.length > 0 ? (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {platforms.map((platform) => {
                    const isPlayed = platform === platformPlayedOn;
                    return (
                      <span
                        key={platform}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all",
                          isPlayed
                            ? "bg-accent/15 border-accent text-accent font-semibold shadow-2xs"
                            : "bg-surface border-border text-text hover:border-text/30"
                        )}
                      >
                        <Gamepad2 className="w-3.5 h-3.5 opacity-70" />
                        <span>{platform}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">
                  Platform details not specified.
                </p>
              )}
            </div>

            {/* Studios & Publishers Card */}
            <div className="p-6 sm:p-7 rounded-2xl card-depth space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent" />
                <span>Development & Publishing</span>
              </h3>

              <div className="space-y-4 pt-1">
                <div>
                  <span className="text-xs text-text-muted flex items-center gap-1.5 mb-1.5 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    <span>Developer Studio</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {developers.length > 0 ? (
                      developers.map((dev) => (
                        <Badge key={dev} variant="subtle" size="md" className="text-xs py-1 px-2.5">
                          {dev}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-text-muted">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-text-muted flex items-center gap-1.5 mb-1.5 font-semibold">
                    <Briefcase className="w-3.5 h-3.5 text-accent" />
                    <span>Publisher</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {publishers.length > 0 ? (
                      publishers.map((pub) => (
                        <Badge key={pub} variant="subtle" size="md" className="text-xs py-1 px-2.5">
                          {pub}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-text-muted">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Screenshots Gallery */}
          {screenshots.length > 0 && (
            <div className="space-y-4 pt-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent" />
                <span>Screenshots & Atmosphere ({screenshots.length})</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {screenshots.slice(0, 6).map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedScreenshot(imgUrl)}
                    className="group relative aspect-video rounded-2xl overflow-hidden poster-depth-sm border border-border/70 hover:border-accent/60 transition-all bg-bg cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <Image
                      src={imgUrl}
                      alt={`${media.title} screenshot ${idx + 1}`}
                      fill
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 33vw"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-2xs">
                      <span className="text-xs font-semibold bg-black/70 px-3 py-1.5 rounded-xl border border-white/20">
                        View Full Atmosphere
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="relative max-w-5xl w-full aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selectedScreenshot}
              alt={`${media.title} full screenshot`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() => setSelectedScreenshot(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
