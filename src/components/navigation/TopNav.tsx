"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Coffee,
  Search,
  User as UserIcon,
  LogOut,
  Settings,
  BookMarked,
  ListOrdered,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { MediaSearchModal } from "@/components/media/MediaSearchModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { searchAlgolia, AlgoliaMediaRecord } from "@/lib/algolia";

export function TopNav() {
  const router = useRouter();
  const { user, profile, signOut, isConfigured } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Algolia Instant Search State in TopNav
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const [navSearchHits, setNavSearchHits] = useState<AlgoliaMediaRecord[]>([]);
  const [isNavSearching, setIsNavSearching] = useState(false);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [isAlgoliaLive, setIsAlgoliaLive] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close profile and search dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsNavDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global shortcut (⌘K or Ctrl+K) to focus navbar search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsNavDropdownOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavSearchChange = (val: string) => {
    setNavSearchQuery(val);
    if (!val.trim()) {
      setNavSearchHits([]);
      setIsNavSearching(false);
      setIsNavDropdownOpen(false);
    }
  };

  // Instant Algolia Search-as-you-type in TopNav
  useEffect(() => {
    const trimmed = navSearchQuery.trim();
    if (!trimmed) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsNavSearching(true);
      try {
        const res = await searchAlgolia(trimmed, { hitsPerPage: 6 });
        if (!cancelled) {
          setNavSearchHits(res.hits);
          setIsAlgoliaLive(res.isAlgoliaLive);
          setIsNavDropdownOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("TopNav Algolia search error:", err);
      } finally {
        if (!cancelled) setIsNavSearching(false);
      }
    }, 90);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [navSearchQuery]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < navSearchHits.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && navSearchHits[selectedIndex]) {
        router.push(`/media/${navSearchHits[selectedIndex].id}`);
        setIsNavDropdownOpen(false);
      } else {
        setIsSearchModalOpen(true);
        setIsNavDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsNavDropdownOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const openLogin = () => {
    setAuthModalMode("login");
    setIsAuthModalOpen(true);
  };

  const openSignup = () => {
    setAuthModalMode("signup");
    setIsAuthModalOpen(true);
  };

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Reader";

  const userInitial = displayName.charAt(0).toUpperCase() || "M";

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-bg/90 border-b border-border transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* 1. Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md shrink-0"
          >
            <div className="w-8 h-8 rounded-md bg-accent text-accent-contrast flex items-center justify-center shadow-xs transition-transform duration-150 motion-safe:group-hover:scale-105">
              <Coffee className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-text leading-none">
                meDiary
              </span>
              <span className="hidden sm:block text-[10px] text-text-muted tracking-wider uppercase font-sans mt-0.5">
                Slow media journal
              </span>
            </div>
          </Link>

          {/* 2. Algolia Instant Search Bar (Desktop/Tablet) */}
          <div ref={searchContainerRef} className="hidden sm:block flex-1 max-w-md mx-2 sm:mx-6 relative">
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={navSearchQuery}
                onChange={(e) => handleNavSearchChange(e.target.value)}
                onFocus={() => {
                  if (navSearchQuery.trim()) setIsNavDropdownOpen(true);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search movies, TV shows, games & books..."
                className="w-full h-9 pl-9 pr-14 text-xs font-sans rounded-md bg-surface text-text border border-border shadow-2xs hover:border-text/30 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-ring outline-none transition-colors"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {isNavSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : navSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNavSearchQuery("");
                      setIsNavDropdownOpen(false);
                    }}
                    className="p-1 text-text-muted hover:text-text cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-bg rounded border border-border hover:border-accent hover:text-text cursor-pointer transition-colors"
                    title="Open Full Search (⌘K)"
                  >
                    ⌘K
                  </button>
                )}
              </div>
            </div>

            {/* Instant Algolia Results Dropdown */}
            {isNavDropdownOpen && navSearchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 max-h-96 flex flex-col">
                <div className="px-3 py-1.5 bg-bg/60 border-b border-border flex items-center justify-between text-[11px] font-mono text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-accent" />
                    <span>Algolia Instant Search</span>
                  </div>
                  {isAlgoliaLive && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Typo-Tolerant
                    </span>
                  )}
                </div>

                <div className="overflow-y-auto divide-y divide-border/40 p-1">
                  {navSearchHits.length === 0 ? (
                    <div className="p-4 text-center space-y-1">
                      {isNavSearching ? (
                        <p className="text-xs text-text-muted">Searching Algolia...</p>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-text">No matches in catalog for &ldquo;{navSearchQuery}&rdquo;</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNavDropdownOpen(false);
                              setIsSearchModalOpen(true);
                            }}
                            className="text-[11px] text-accent hover:underline cursor-pointer pt-1 block mx-auto"
                          >
                            Search external databases (TMDB / RAWG / Books) →
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    navSearchHits.map((hit, idx) => {
                      const isSelected = selectedIndex === idx;
                      return (
                        <Link
                          key={hit.id}
                          href={`/media/${hit.id}`}
                          onClick={() => setIsNavDropdownOpen(false)}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-accent/15 text-accent"
                              : "hover:bg-surface-hover text-text"
                          }`}
                        >
                          <div className="relative w-9 h-12 rounded bg-bg overflow-hidden shrink-0 border border-border">
                            {hit.cover_url ? (
                              <Image
                                src={hit.cover_url}
                                alt={hit.title}
                                fill
                                sizes="36px"
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-text-muted">
                                {hit.type === "movie" ? (
                                  <Film className="w-4 h-4" />
                                ) : hit.type === "tv" ? (
                                  <Tv className="w-4 h-4" />
                                ) : hit.type === "book" ? (
                                  <BookOpen className="w-4 h-4" />
                                ) : (
                                  <Gamepad2 className="w-4 h-4" />
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-serif text-xs font-semibold truncate text-text">
                                {hit.title}
                              </span>
                              {hit.year && (
                                <span className="text-[10px] font-mono text-text-muted shrink-0">
                                  ({hit.year})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                              <span className="capitalize font-mono text-[9px] px-1 py-0.2 rounded bg-bg border border-border">
                                {hit.type}
                              </span>
                              {hit.community_rating_avg ? (
                                <span className="flex items-center gap-0.5 text-accent font-semibold">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  {(hit.community_rating_avg / 10).toFixed(1)}
                                </span>
                              ) : null}
                              {hit.author && (
                                <span className="truncate">by {hit.author}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-t border-border bg-bg/40 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">
                    Press <kbd className="px-1 py-0.2 text-[9px] font-mono bg-surface border border-border rounded">Enter</kbd> to explore
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNavDropdownOpen(false);
                      setIsSearchModalOpen(true);
                    }}
                    className="text-accent hover:underline font-medium cursor-pointer"
                  >
                    Open Full Catalog Search (⌘K) →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Right Controls: Mobile search button + Diary + Lists + Theme + Profile / Auth */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            {/* Mobile Search Button (Quick trigger for full catalog search) */}
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer shrink-0"
              title="Search catalog (⌘K)"
              aria-label="Search catalog"
            >
              <Search className="w-4 h-4 text-accent" />
            </button>

            <Link
              href="/diary"
              className="inline-flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-text hover:text-accent rounded-md hover:bg-surface transition-colors cursor-pointer shrink-0"
              title="Media Diary"
            >
              <BookMarked className="w-3.5 h-3.5 text-accent" />
              <span className="hidden md:inline">Diary</span>
            </Link>

            <Link
              href="/lists"
              className="inline-flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-text hover:text-accent rounded-md hover:bg-surface transition-colors cursor-pointer shrink-0"
              title="Custom Lists"
            >
              <ListOrdered className="w-3.5 h-3.5 text-accent" />
              <span className="hidden md:inline">Lists</span>
            </Link>

            <ThemeToggle className="hidden sm:inline-flex" />

            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer shrink-0"
              title="Settings & Rating Scale"
              aria-label="Settings & Rating Scale"
            >
              <Settings className="w-4 h-4" />
            </button>

            {user ? (
              /* Authenticated Profile Menu */
              <div className="relative shrink-0" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-1 sm:gap-2 p-1 pl-1 sm:pl-1.5 pr-1.5 sm:pr-2.5 rounded-full bg-surface border border-border hover:border-text/25 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-full bg-accent text-accent-contrast font-serif font-semibold text-xs flex items-center justify-center">
                    {userInitial}
                  </div>
                  <span className="hidden md:inline-block text-xs font-medium text-text max-w-[110px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                </button>

                {/* Profile Dropdown */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg bg-surface border border-border shadow-lg py-2 z-50 animate-in fade-in-50 zoom-in-95">
                    {/* User Header */}
                    <div className="px-4 py-2.5 border-b border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-text truncate">
                          {displayName}
                        </p>
                        <Badge variant="amber" size="sm">
                          {profile?.default_privacy || "Public"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-text-muted truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <Link
                        href={`/u/${user.id}`}
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-accent" />
                        <span>Public Profile</span>
                      </Link>
                      <Link
                        href="/diary"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <Film className="w-3.5 h-3.5 text-accent" />
                        <span>My Media Journal / Diary</span>
                      </Link>
                      <Link
                        href="/lists"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <ListOrdered className="w-3.5 h-3.5 text-accent" />
                        <span>Custom Lists & Rankings</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsSettingsModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-accent" />
                        <span>Profile & Rating Scale</span>
                      </button>
                      <Link
                        href="/settings"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-accent" />
                        <span>Settings & Algolia Index</span>
                      </Link>
                      <div className="px-4 py-1.5 flex items-center justify-between text-xs text-text-muted">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-accent-secondary" />
                          <span>RLS Protection</span>
                        </div>
                        <span className="text-[10px] font-mono text-accent-secondary">
                          {isConfigured ? "Postgres RLS" : "Active"}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Theme Toggle */}
                    <div className="sm:hidden px-4 py-2 border-t border-border">
                      <ThemeToggle />
                    </div>

                    {/* Divider & Sign Out */}
                    <div className="border-t border-border pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          signOut();
                        }}
                        className="w-full px-4 py-2 text-left flex items-center gap-2 text-xs text-red-600 dark:text-red-400 hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Unauthenticated Buttons */
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openLogin}
                  className="hidden xs:inline-flex"
                >
                  Log In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openSignup}
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  <span className="hidden xs:inline">Sign Up</span>
                  <span className="xs:hidden">Join</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
      />

      {/* TMDB Media Search & Sync Modal */}
      <MediaSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        initialQuery={navSearchQuery}
      />

      {/* Profile & Rating Scale Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
}
