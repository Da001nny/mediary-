"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { Tv, Film, ShoppingBag, ExternalLink, Globe, Info } from "lucide-react";
import type { WatchProvidersCountry, WatchProviderItem } from "@/types/database.types";
import { formatCountryOption, getCountryName } from "@/lib/countries";
import { useAuth } from "@/context/AuthContext";

interface WatchProvidersSectionProps {
  watchProviders: Record<string, WatchProvidersCountry> | null | undefined;
  defaultRegion?: string | null;
}

export function WatchProvidersSection({
  watchProviders,
  defaultRegion,
}: WatchProvidersSectionProps) {
  const { profile } = useAuth();

  // All country codes present in the fetched watch_providers JSONB
  const availableCountryCodes = useMemo(() => {
    if (!watchProviders || typeof watchProviders !== "object") return [];
    return Object.keys(watchProviders).filter((code) => {
      const data = watchProviders[code];
      return (
        data &&
        (Boolean(data.flatrate?.length) ||
          Boolean(data.rent?.length) ||
          Boolean(data.buy?.length) ||
          Boolean(data.link))
      );
    }).sort((a, b) => a.localeCompare(b));
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

  return (
    <section className="bg-surface rounded-xl border border-border p-6 shadow-sm">
      {/* Header & Country Select */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent" />
            <h2 className="font-serif text-xl font-bold text-text">
              Where to Watch
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Streaming availability, rentals, and digital purchase options
          </p>
        </div>

        {/* Country Selector Dropdown */}
        <div className="flex flex-col sm:items-end gap-1.5">
          <label
            htmlFor="country-selector"
            className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
          >
            Country / Region
          </label>
          <div className="relative inline-block w-full sm:w-auto">
            <select
              id="country-selector"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full sm:w-64 appearance-none bg-bg border border-border rounded-lg px-3.5 py-2 pr-9 text-xs font-medium text-text shadow-sm hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-colors cursor-pointer"
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Region Switcher Buttons (only if multiple regions exist) */}
      {quickCountries.length > 1 && (
        <div className="flex items-center gap-1.5 py-3 border-b border-border/60 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] text-text-muted mr-1 whitespace-nowrap">
            Popular:
          </span>
          {quickCountries.map((c) => {
            const isSelected = selectedCountry === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCountry(c)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-accent text-white shadow-xs"
                    : "bg-bg border border-border text-text hover:bg-border/40"
                }`}
              >
                {formatCountryOption(c).flag} {c}
              </button>
            );
          })}
        </div>
      )}

      {/* Providers Content */}
      <div className="pt-6 space-y-6">
        {totalOptionsCount === 0 ? (
          <div className="py-10 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-bg border border-border flex items-center justify-center mx-auto text-text-muted">
              <Tv className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-medium text-text">
              No watch providers listed for {getCountryName(selectedCountry)} ({selectedCountry})
            </p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              This title may not currently be licensed for streaming or digital purchase in this region. You can select another country from the dropdown above.
            </p>
          </div>
        ) : (
          <>
            {/* Stream / Subscription (Flatrate) */}
            {flatrateList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                    Stream / Subscription
                  </h3>
                  <span className="text-xs text-text-muted">
                    ({flatrateList.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {flatrateList.map((provider) => (
                    <ProviderCard
                      key={`stream-${provider.provider_id}`}
                      provider={provider}
                      type="Stream"
                      link={justWatchLink}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Rent */}
            {rentList.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                    Rent
                  </h3>
                  <span className="text-xs text-text-muted">
                    ({rentList.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {rentList.map((provider) => (
                    <ProviderCard
                      key={`rent-${provider.provider_id}`}
                      provider={provider}
                      type="Rent"
                      link={justWatchLink}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Buy */}
            {buyList.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                    Buy
                  </h3>
                  <span className="text-xs text-text-muted">
                    ({buyList.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {buyList.map((provider) => (
                    <ProviderCard
                      key={`buy-${provider.provider_id}`}
                      provider={provider}
                      type="Buy"
                      link={justWatchLink}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Attribution footer */}
      <div className="mt-8 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-text-muted">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-accent opacity-80" />
          <span>
            Streaming data provided by <strong>JustWatch</strong> via TMDB
          </span>
        </div>

        {justWatchLink && (
          <a
            href={justWatchLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
          >
            <span>View all options on JustWatch</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </section>
  );
}

function ProviderCard({
  provider,
  type,
  link,
}: {
  provider: WatchProviderItem;
  type: string;
  link?: string;
}) {
  const logoUrl = provider.logo_path
    ? `https://image.tmdb.org/t/p/w154${provider.logo_path}`
    : null;

  const content = (
    <div className="flex items-center gap-2.5 p-2 bg-bg rounded-lg border border-border hover:border-accent/40 transition-colors group">
      <div className="relative w-8 h-8 rounded-md overflow-hidden bg-surface shrink-0 border border-border/50">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={provider.provider_name}
            fill
            sizes="32px"
            className="object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
            {provider.provider_name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
          {provider.provider_name}
        </div>
        <div className="text-[10px] text-text-muted capitalize">
          {type}
        </div>
      </div>
    </div>
  );

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        title={`Watch on ${provider.provider_name} via JustWatch`}
        className="block cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 rounded-lg"
      >
        {content}
      </a>
    );
  }

  return content;
}
