"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Coffee,
  Search,
  User as UserIcon,
  LogOut,
  Settings,
  BookMarked,
  ShieldCheck,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

export function TopNav() {
  const { user, profile, signOut, isConfigured } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global shortcut (⌘K or Ctrl+K) to focus search placeholder
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchActive(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* 1. Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            <div className="w-8 h-8 rounded-md bg-accent text-accent-contrast flex items-center justify-center shadow-xs transition-transform duration-150 motion-safe:group-hover:scale-105">
              <Coffee className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xl font-bold tracking-tight text-text leading-none">
                meDiary
              </span>
              <span className="text-[10px] text-text-muted tracking-wider uppercase font-sans mt-0.5">
                Slow media journal
              </span>
            </div>
          </Link>

          {/* 2. Search Bar Placeholder */}
          <div className="flex-1 max-w-md mx-2 sm:mx-6 relative">
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search movies, TV shows, games, books..."
                onFocus={() => setIsSearchActive(true)}
                onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
                className="w-full h-9 pl-9 pr-14 text-xs font-sans rounded-md bg-surface text-text border border-border shadow-2xs placeholder:text-text-muted/60 outline-none transition-colors hover:border-text/25 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="absolute right-2 flex items-center pointer-events-none">
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-bg rounded border border-border">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Quick search focus cue */}
            {isSearchActive && (
              <div className="absolute top-11 left-0 right-0 p-3 bg-surface rounded-md border border-border shadow-lg text-xs text-text-muted space-y-1.5 z-50">
                <div className="flex items-center justify-between text-text font-medium pb-1 border-b border-border">
                  <span className="font-serif">Universal Media Search</span>
                  <Badge variant="sage" size="sm">
                    Coming in Search Phase
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Search integration with TMDB (movies/TV), IGDB/RAWG (games), and
                  Google Books/Open Library will be connected in an upcoming
                  phase.
                </p>
              </div>
            )}
          </div>

          {/* 3. Right Controls: Theme + Profile / Auth */}
          <div className="flex items-center gap-3">
            <ThemeToggle className="hidden sm:inline-flex" />

            {user ? (
              /* Authenticated Profile Menu */
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-surface border border-border hover:border-text/25 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-2xs"
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
                        <Badge variant="caramel" size="sm">
                          {profile?.default_privacy || "Public"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-text-muted truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer">
                        <UserIcon className="w-3.5 h-3.5 text-accent" />
                        <span>My Media Journal</span>
                      </div>
                      <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer">
                        <BookMarked className="w-3.5 h-3.5 text-accent-secondary" />
                        <span>Curated Lists</span>
                      </div>
                      <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer">
                        <Settings className="w-3.5 h-3.5 text-text-muted" />
                        <span>Profile Preferences</span>
                      </div>
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openLogin}
                  className="text-xs"
                >
                  Log In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openSignup}
                  className="text-xs"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  Sign Up
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
    </>
  );
}
