import React from "react";
import Link from "next/link";
import { BookMarked } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/80 bg-surface/30 backdrop-blur-xs mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border/60">
          {/* Brand & Purpose */}
          <div className="space-y-2 max-w-md">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-text hover:text-accent transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <BookMarked className="w-4 h-4" />
              </div>
              <span className="font-serif font-bold text-lg tracking-tight">
                meDiary
              </span>
            </Link>
            <p className="text-xs text-text-muted leading-relaxed">
              A calm, warm media journal for logging and reviewing movies, TV
              shows, video games, and books.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted font-medium">
            <Link
              href="/diary"
              className="hover:text-text transition-colors underline-offset-4 hover:underline"
            >
              Diary
            </Link>
            <Link
              href="/lists"
              className="hover:text-text transition-colors underline-offset-4 hover:underline"
            >
              Lists
            </Link>
            <Link
              href="/stats"
              className="hover:text-text transition-colors underline-offset-4 hover:underline"
            >
              Stats
            </Link>
            <Link
              href="/year"
              className="hover:text-text transition-colors underline-offset-4 hover:underline"
            >
              Year in Review
            </Link>
            <Link
              href="/privacy"
              className="hover:text-text transition-colors underline-offset-4 hover:underline text-text"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-text transition-colors underline-offset-4 hover:underline text-text"
            >
              Terms
            </Link>
          </div>
        </div>

        {/* Credits & Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-text-muted leading-relaxed">
          <div className="max-w-xl">
            <span className="font-semibold text-text/80">Credits:</span>{" "}
            Movie and TV data from TMDB. This product uses the TMDB API but is not
            endorsed or certified by TMDB. Game data from RAWG. Book data from
            Google Books.
          </div>
          <div className="shrink-0 text-text-muted/70 font-mono">
            &copy; {new Date().getFullYear()} meDiary
          </div>
        </div>
      </div>
    </footer>
  );
}
