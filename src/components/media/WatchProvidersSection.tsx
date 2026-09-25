"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  Tv,
  Film,
  ShoppingBag,
  ExternalLink,
  Globe,
  Info,
  ChevronDown,
} from "lucide-react";
import type { WatchProvidersCountry, WatchProviderItem } from "@/types/database.types";
import { formatCountryOption, getCountryName } from "@/lib/countries";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface WatchProvidersSectionProps {
  watchProviders: Record<string, WatchProvidersCountry> | null | undefined;
  defaultRegion?: string | null;
}

export function WatchProvidersSection({
  watchProviders,
  defaultRegion,
}: WatchProvidersSectionProps) {
  const { profile } = useAuth();
  // Collapsed by default as requested
  const [isExpanded, setIsExpanded] = useState(false);

  // All country codes present in the fetched watch_providers JSONB
  const availableCountryCodes = useMemo(() => {
    if (!watchProviders || typeof watchProviders !== "object") return [];
    return Object.keys(watchProviders)
      .filter((code) => {
        const data = watchProviders[code];
        return (
          data &&
          (Boolean(data.flatrate?.length) ||
            Boolean(data.rent?.length) ||
            Boolean(data.buy?.length) ||
            Boolean(data.link))
        );
      })
      .sort((a, b) => a.localeCompare(b));
  }, [watchProviders]);

  // Determine the best initial country:
  // User's home country from profile -> defaultRegion prop -> "US" -> first available country
  const preferredCountry = useMemo(() => {
    const userCountry = (profile?.region || defaultRegion || "US").toUpperCase();
    if (availableCountryCodes.includes(userCountry)) {
      return userCountry;
    }
    if (availableCountryCodes.includes("US")) {
      return "US";
    }
    return availableCountryCodes[0] || "US";
  }, [profile?.region, defaultRegion, availableCountryCodes]);

  const [selectedCountry, setSelectedCountry] = useState<string>(preferredCountry);

  // Active country's providers from the already-fetched data (NO extra API call)
  const currentProviders: WatchProvidersCountry | undefined = useMemo(() => {
    if (!watchProviders) return undefined;
    return watchProviders[selectedCountry];
  }, [watchProviders, selectedCountry]);

  const flatrateList: WatchProviderItem[] = currentProviders?.flatrate || [];
  const rentList: WatchProviderItem[] = currentProviders?.rent || [];
  const buyList: WatchProviderItem[] = currentProviders?.buy || [];
  const justWatchLink = currentProviders?.link;

  const totalOptionsCount =
    flatrateList.length + rentList.length + buyList.length;

  const quickCountries = ["US", "GB", "CA", "AU", "DE", "FR", "JP"].filter(
    (c) => availableCountryCodes.includes(c)
  );

  // Top distinct providers for preview when collapsed
  const previewProviders = useMemo(() => {
    if (!currentProviders) return [];
    const list: WatchProviderItem[] = [];
    const seen = new Set<number>();
    const all = [
      ...(currentProviders.flatrate || []),
      ...(currentProviders.rent || []),
      ...(currentProviders.buy || []),
    ];
    for (const item of all) {
      if (!seen.has(item.provider_id) && item.logo_path) {
        seen.add(item.provider_id);
        list.push(item);
      }
    }
    return list.slice(0, 6);
  }, [currentProviders]);

  const selectedCountryName = getCountryName(selectedCountry);

  return (
    <section className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden transition-colors">
      {/* Collapsible Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-surface-hover/40 transition-colors select-none group"
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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-text group-hover:text-accent transition-colors">
                Where to Watch
              </h2>
              <Badge variant="subtle" size="sm" className="font-mono">
                {totalOptionsCount > 0
                  ? `${totalOptionsCount} in ${selectedCountry}`
                  : `${availableCountryCodes.length} regions`}
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Streaming availability, digital rentals, and purchase options
            </p>
          </div>
        </div>

        {/* Collapsed Preview & Expand Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Top Provider Logos Preview when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              {previewProviders.length > 0 ? (
                <div className="flex items-center -space-x-1.5">
                  {previewProviders.map((provider) => (
                    <div
                      key={provider.provider_id}
                      className="relative w-7 h-7 rounded-md overflow-hidden bg-bg border border-border shadow-2xs shrink-0"
                      title={provider.provider_name}
                    >
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        fill
                        sizes="28px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                  {totalOptionsCount > previewProviders.length && (
                    <span className="text-[10px] font-mono text-text-muted pl-2">
                      +{totalOptionsCount - previewProviders.length}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-text-muted font-sans italic">
                  {availableCountryCodes.length > 0
                    ? `Switch country (${selectedCountry})`
                    : "No providers listed"}
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
            {isExpanded ? "Collapse" : "Explore"}
          </Button>
        </div>
      </div>

      {/* Expanded Animated Content (deliberate motion moment) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="watch-providers-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-5 sm:p-6 space-y-6">
              {/* Country Selector Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text">
                    Select Your Country
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Showing availability for{" "}
                    <strong className="text-text">{selectedCountryName}</strong>. Swapping
                    countries filters instant offline TMDB data without extra API calls.
                  </p>
                </div>

                {/* Country Selector Dropdown */}
                <div className="flex flex-col sm:items-end gap-1.5">
                  <div className="relative inline-block w-full sm:w-auto">
                    <select
                      id="country-selector"
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full sm:w-64 appearance-none bg-bg border border-border rounded-lg px-3.5 py-2 pr-9 text-xs font-medium text-text shadow-2xs hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-colors cursor-pointer"
                    >
                      {availableCountryCodes.length === 0 ? (
                        <option value="US">🇺🇸 United States (US)</option>
                      ) : (
                        availableCountryCodes.map((code) => {
                          const opt = formatCountryOption(code);
                          return (
                            <option key={code} value={code}>
                              {opt.label}
                            </option>
                          );
                        })
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-text-muted">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Country Filters */}
              {quickCountries.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-text-muted mr-1">
                    Quick switch:
                  </span>
                  {quickCountries.map((code) => {
                    const opt = formatCountryOption(code);
                    const isActive = selectedCountry === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setSelectedCountry(code)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                          isActive
                            ? "bg-accent text-accent-contrast border-accent font-semibold shadow-2xs"
                            : "bg-bg text-text-muted border-border hover:text-text hover:border-text/25"
                        }`}
                      >
                        {opt.flag} {code}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Providers Lists */}
              {totalOptionsCount === 0 ? (
                <div className="py-10 text-center space-y-3 bg-bg/50 rounded-lg border border-dashed border-border/80">
                  <div className="w-10 h-10 rounded-full bg-surface text-text-muted mx-auto flex items-center justify-center">
                    <Info className="w-5 h-5 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-text">
                    No streaming or purchase options reported in {selectedCountryName}
                  </p>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Try switching to another country from the dropdown above, or check
                    JustWatch for recent updates.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Flatrate / Streaming */}
                  <ProviderCategoryCard
                    title="Stream"
                    icon={<Tv className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    items={flatrateList}
                    emptyMessage="No subscription streaming available"
                  />

                  {/* Rent */}
                  <ProviderCategoryCard
                    title="Rent"
                    icon={<Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    items={rentList}
                    emptyMessage="No digital rental options"
                  />

                  {/* Buy */}
                  <ProviderCategoryCard
                    title="Buy"
                    icon={<ShoppingBag className="w-4 h-4 text-accent" />}
                    items={buyList}
                    emptyMessage="No digital purchase options"
                  />
                </div>
              )}

              {/* JustWatch Attribution Footer */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
                <span className="text-[11px]">
                  Streaming data powered by <strong>JustWatch</strong> via The Movie
                  Database.
                </span>

                {justWatchLink && (
                  <a
                    href={justWatchLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-accent hover:underline font-medium text-[11px]"
                  >
                    <span>View all viewing options on JustWatch</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ProviderCategoryCard({
  title,
  icon,
  items,
  emptyMessage,
}: {
  title: string;
  icon: React.ReactNode;
  items: WatchProviderItem[];
  emptyMessage: string;
}) {
  return (
    <div className="bg-bg/60 border border-border rounded-lg p-4 flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-text">
            {icon}
            <span>{title}</span>
          </div>
          <span className="text-[11px] font-mono text-text-muted">
            {items.length} {items.length === 1 ? "option" : "options"}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-text-muted italic py-3">{emptyMessage}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <div
                key={item.provider_id}
                className="flex items-center gap-2 p-1.5 rounded-md bg-surface border border-border/70 hover:border-accent/40 transition-colors group"
              >
                {item.logo_path ? (
                  <div className="relative w-7 h-7 rounded-sm overflow-hidden shrink-0 border border-border/50">
                    <Image
                      src={`https://image.tmdb.org/t/p/w92${item.logo_path}`}
                      alt={item.provider_name}
                      fill
                      sizes="28px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-sm bg-border/40 shrink-0 flex items-center justify-center text-[10px] font-bold text-text-muted">
                    {item.provider_name.charAt(0)}
                  </div>
                )}
                <span className="text-[11px] font-medium text-text group-hover:text-accent transition-colors line-clamp-1 leading-tight">
                  {item.provider_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
