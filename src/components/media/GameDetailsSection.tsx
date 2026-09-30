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
    <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs transition-colors">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
                Game Specs & Platforms
              </h2>
              <Badge variant="subtle" size="sm">
                Video Game
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Available platforms, developer studios, and gameplay details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent font-medium px-2.5 py-1.5 rounded-md hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              <span>Official Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs gap-1.5 text-text-muted hover:text-text cursor-pointer"
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
        <div className="p-5 sm:p-6 space-y-6">
          {/* Key Specs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Metacritic */}
            {metacritic !== null ? (
              <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-accent" />
                  <span>Metacritic</span>
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-sm font-bold border",
                      getMetacriticColor(metacritic)
                    )}
                  >
                    {metacritic}
                  </span>
                  <span className="text-xs text-text-muted">/ 100</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-text-muted" />
                  <span>Rating</span>
                </span>
                <div className="mt-2">
                  <span className="text-xs text-text-muted">Not rated</span>
                </div>
              </div>
            )}

            {/* ESRB Rating */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                <span>Age Rating</span>
              </span>
              <div className="mt-2">
                <span className="text-xs font-semibold text-text">
                  {esrbRating || "Rating Pending"}
                </span>
              </div>
            </div>

            {/* Average Playtime */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>Avg. Playtime</span>
              </span>
              <div className="mt-2">
                <span className="text-xs font-semibold text-text">
                  {playtime ? `~${playtime} Hours` : "Varied"}
                </span>
              </div>
            </div>

            {/* Genres */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Primary Genre</span>
              </span>
              <div className="mt-2">
                <span className="text-xs font-semibold text-text truncate block">
                  {media.genres?.[0] || String(typeSpecific.genre || "Action")}
                </span>
              </div>
            </div>
          </div>

          {/* Platforms & Studios Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Platforms Card */}
            <div className="p-4 rounded-lg bg-bg border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-accent" />
                  <span>Available Platforms ({platforms.length})</span>
                </h3>
                {platformPlayedOn && (
                  <Badge variant="subtle" size="sm" className="text-[10px]">
                    Played on {platformPlayedOn}
                  </Badge>
                )}
              </div>

              {platforms.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {platforms.map((platform) => {
                    const isPlayed = platform === platformPlayedOn;
                    return (
                      <span
                        key={platform}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5",
                          isPlayed
                            ? "bg-accent/15 border-accent text-accent font-semibold"
                            : "bg-surface border-border text-text hover:border-text/30"
                        )}
                      >
                        <Gamepad2 className="w-3 h-3 opacity-70" />
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
            <div className="p-4 rounded-lg bg-bg border border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent" />
                <span>Development & Publishing</span>
              </h3>

              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-[11px] text-text-muted flex items-center gap-1.5 mb-1 font-medium">
                    <Building2 className="w-3 h-3 text-accent" />
                    <span>Developer Studio</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {developers.length > 0 ? (
                      developers.map((dev) => (
                        <Badge key={dev} variant="subtle" size="md">
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
                  <span className="text-[11px] text-text-muted flex items-center gap-1.5 mb-1 font-medium">
                    <Briefcase className="w-3 h-3 text-accent" />
                    <span>Publisher</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {publishers.length > 0 ? (
                      publishers.map((pub) => (
                        <Badge key={pub} variant="subtle" size="md">
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
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent" />
                <span>Screenshots & Atmosphere ({screenshots.length})</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {screenshots.slice(0, 6).map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedScreenshot(imgUrl)}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-border hover:border-accent/60 transition-all bg-bg cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <Image
                      src={imgUrl}
                      alt={`${media.title} screenshot ${idx + 1}`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 33vw"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <span className="text-xs font-medium bg-black/60 px-2 py-1 rounded backdrop-blur-xs">
                        View Full
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
