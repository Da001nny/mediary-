import Link from "next/link";
import Image from "next/image";
import { Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { MediaItem } from "@/types/database.types";

interface PopularRightNowSectionProps {
  items: MediaItem[];
  activeType: "movie" | "tv" | "game";
  currentSearchParams?: Record<string, string | string[] | undefined>;
}

export function PopularRightNowSection({
  items,
  activeType,
  currentSearchParams,
}: PopularRightNowSectionProps) {
  if (items.length === 0) return null;

  function buildTabHref(typeVal: string) {
    const params = new URLSearchParams();
    if (currentSearchParams) {
      for (const [key, val] of Object.entries(currentSearchParams)) {
        if (key !== "popular_type" && typeof val === "string") {
          params.set(key, val);
        }
      }
    }
    params.set("popular_type", typeVal);
    return `/?${params.toString()}`;
  }

  const TABS = [
    { label: "Movies", value: "movie" },
    { label: "TV", value: "tv" },
    { label: "Games", value: "game" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
            Popular right now
          </h2>
        </div>

        {/* Movies / TV Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {TABS.map((tab) => {
            const isActive = activeType === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildTabHref(tab.value)}
                scroll={false}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-accent text-accent-contrast shadow-2xs font-semibold"
                    : "bg-surface border border-border text-text-muted hover:text-text hover:border-accent/50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Grid of items matching the "More like this" panel style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/media/${encodeURIComponent(item.id)}`}
            className="group block h-full focus-visible:outline-none"
          >
            <Card
              variant="interactive"
              className="p-2.5 sm:p-3 flex flex-col h-full bg-surface hover:border-accent transition-all"
            >
              <div className="relative aspect-2/3 w-full rounded-xl overflow-hidden bg-bg/80 shrink-0 poster-depth-sm mb-2.5">
                {item.cover_url ? (
                  <Image
                    src={item.cover_url}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted font-serif text-xs font-semibold p-1 text-center">
                    {item.title ? item.title.slice(0, 2).toUpperCase() : "??"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-xs sm:text-sm font-bold text-text group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                  {item.title}
                </h3>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
