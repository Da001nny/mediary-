"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Film,
  Tv,
  Gamepad2,
  Search,
  Check,
  Coffee,
  Bookmark,
  Sparkles,
  Heart,
  Sliders,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardDivider,
} from "@/components/ui/Card";
import { Badge, EditorialMetadata } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DesignFoundationPage() {
  const [simulatedLoading, setSimulatedLoading] = useState(false);
  const [inputValue, setInputValue] = useState("Krzysztof Kieślowski");
  const [errorInputValue, setErrorInputValue] = useState("invalid-entry");
  const [buttonClickCount, setButtonClickCount] = useState(0);

  const toggleLoading = () => {
    setSimulatedLoading(true);
    setTimeout(() => setSimulatedLoading(false), 1600);
  };

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/25 selection:text-text">
      {/* Header bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-bg/85 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-accent text-accent-contrast flex items-center justify-center shadow-xs">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-2xl font-bold tracking-tight text-text">
                  meDiary
                </span>
                <span className="text-[11px] uppercase tracking-widest text-text-muted font-sans font-medium">
                  Design Foundation
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Slow coffee-shop morning aesthetic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        {/* Intro Hero: Editorial & Restrained */}
        <section className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-accent font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phase 1 · Token System & Component Primitives</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-text leading-[1.15]">
            A calm, warm morning at the corner table.
          </h1>
          <p className="text-base sm:text-lg text-text-muted leading-relaxed font-sans">
            meDiary departs from generic SaaS design in favor of a tactile,
            coffee-table aesthetic. Colors invert seamlessly between warm oat
            beige and deep espresso through CSS custom properties. Hairline
            dividers, quiet typography, and generous whitespace frame cinema,
            television, literature, and games.
          </p>

          <EditorialMetadata
            items={[
              "Tokens: CSS Custom Variables",
              "Light: Oat & Milk Foam (#EDE4D3 / #F6F0E4)",
              "Dark: Deep Espresso (#241812 / #2E211A)",
              "Headings: Fraunces (Serif)",
              "Body: Work Sans (Humanist)",
              "Motion: Prefers-Reduced Compliant",
            ]}
            className="pt-2"
          />
        </section>

        {/* 1. Color Palette Tokens */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold text-text">
              Color Tokens & Contrast
            </h2>
            <span className="text-xs text-text-muted font-mono">
              Defined in globals.css
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Oat Beige */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-bg)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">--color-bg</p>
                <p className="text-[11px] text-text-muted">Warm Oat Beige</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #EDE4D3 / #241812
                </p>
              </div>
            </div>

            {/* Milk Foam */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-surface)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-surface
                </p>
                <p className="text-[11px] text-text-muted">Milk-Foam Cards</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #F6F0E4 / #2E211A
                </p>
              </div>
            </div>

            {/* Espresso Brown */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-text)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">--color-text</p>
                <p className="text-[11px] text-text-muted">Espresso Brown</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #3E2723 / #F6F0E4
                </p>
              </div>
            </div>

            {/* Warm Taupe */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-text-muted)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-text-muted
                </p>
                <p className="text-[11px] text-text-muted">Warm Taupe</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #8A7461 / #B39E8C
                </p>
              </div>
            </div>

            {/* Muted Caramel */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-accent
                </p>
                <p className="text-[11px] text-text-muted">Muted Caramel</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #B8834B / #C58E54
                </p>
              </div>
            </div>

            {/* Dusty Sage */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-accent-secondary)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-accent-secondary
                </p>
                <p className="text-[11px] text-text-muted">Dusty Sage</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #7C8B6F / #8E9F7F
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Typography Foundation */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold text-text">
              Typography Pairing
            </h2>
            <span className="text-xs text-text-muted">
              Fraunces Serif + Work Sans
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="default">
              <CardHeader>
                <div className="text-xs font-mono text-text-muted">
                  Headings · next/font/google
                </div>
                <CardTitle className="text-2xl pt-1">
                  Fraunces (Soft-Contrast Serif)
                </CardTitle>
                <CardDescription>
                  Warm, bookish serif with delicate curves and rich editorial
                  character, perfect for book chapters, film retrospectives, and
                  journal titles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="font-serif text-3xl font-bold text-text">
                    La Double Vie de Véronique
                  </p>
                  <p className="font-serif text-xl font-medium text-text">
                    In Search of Lost Time: Swann’s Way
                  </p>
                  <p className="font-serif text-lg italic text-text-muted">
                    “Coffee is a lot more than just a drink; it’s something
                    happening.”
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <div className="text-xs font-mono text-text-muted">
                  Body & UI · next/font/google
                </div>
                <CardTitle className="text-2xl pt-1 font-serif">
                  Work Sans (Humanist)
                </CardTitle>
                <CardDescription>
                  Clean, open geometric proportions optimized for high
                  legibility in labels, metadata, ratings, lists, and lengthy
                  thoughtful reviews.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-sans">
                <p className="text-sm text-text leading-relaxed">
                  Regular weight (400) creates an effortless reading rhythm.
                  Generous counter shapes and optical balance maintain clarity
                  across small screen sizes and high-density log entries.
                </p>
                <EditorialMetadata
                  items={[
                    "Release: Nov 1991",
                    "Director: Krzysztof Kieślowski",
                    "Runtime: 98 min",
                    "Rating: 94/100",
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 3. Component Library: Buttons */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Button Component
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Variants, sizes, loading & reduced-motion states
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted">
              src/components/ui/Button.tsx
            </span>
          </div>

          <div className="p-6 rounded-lg bg-surface border border-border space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-3">
                Variants (Primary, Secondary, Sage Highlight, Outline, Ghost)
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="primary"
                  leftIcon={<Bookmark className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Primary Caramel
                </Button>

                <Button
                  variant="secondary"
                  leftIcon={<Coffee className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Secondary Milk-Foam
                </Button>

                <Button
                  variant="sage"
                  leftIcon={<Heart className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Dusty Sage Highlight
                </Button>

                <Button
                  variant="outline"
                  leftIcon={<Compass className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Caramel Outline
                </Button>

                <Button
                  variant="ghost"
                  leftIcon={<Sliders className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Quiet Ghost
                </Button>
              </div>
            </div>

            <CardDivider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sizes */}
              <div>
                <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-3">
                  Sizes (sm: 32px, md: 40px, lg: 44px)
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="secondary">
                    Small Log
                  </Button>
                  <Button size="md" variant="secondary">
                    Medium Log
                  </Button>
                  <Button size="lg" variant="secondary">
                    Large Log
                  </Button>
                </div>
              </div>

              {/* States */}
              <div>
                <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-3">
                  States (Loading, Disabled, Interaction)
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    isLoading={simulatedLoading}
                    onClick={toggleLoading}
                  >
                    {simulatedLoading ? "Saving..." : "Click to Test Loading"}
                  </Button>
                  <Button variant="secondary" disabled>
                    Disabled Button
                  </Button>
                </div>
              </div>
            </div>

            {buttonClickCount > 0 && (
              <p className="text-xs text-text-muted font-sans">
                Interactive clicks recorded: {buttonClickCount}
              </p>
            )}
          </div>
        </section>

        {/* 4. Component Library: Cards */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Card Component & Coffee-Table Layout
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Soft asymmetric rhythm, hairline dividers, zero-pill metadata
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted">
              src/components/ui/Card.tsx
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Book spine style */}
            <Card variant="book" className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span className="uppercase tracking-wider font-medium text-[11px] text-accent">
                    Book Spine Motif
                  </span>
                  <span>Pages 240 / 312</span>
                </div>
                <CardTitle>Norwegian Wood</CardTitle>
                <CardDescription>Haruki Murakami · Novel (1987)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-text leading-relaxed line-clamp-3">
                  A nostalgic story of loss and sexuality, told from the
                  perspective of Toru Watanabe as he looks back on his student
                  days in late 1960s Tokyo.
                </p>
                <CardDivider />
                <EditorialMetadata
                  items={["Fiction", "Japan", "In Progress (77%)"]}
                />
              </CardContent>
              <CardFooter className="justify-between border-t border-border pt-4">
                <span className="text-xs text-text-muted">Logged yesterday</span>
                <Badge variant="sage" size="sm" dot dotColor="sage">
                  Reading
                </Badge>
              </CardFooter>
            </Card>

            {/* 2. Editorial accent style */}
            <Card variant="editorial" className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span className="uppercase tracking-wider font-medium text-[11px] text-accent-secondary">
                    Editorial Top Border
                  </span>
                  <span>96/100 Rating</span>
                </div>
                <CardTitle>Chungking Express</CardTitle>
                <CardDescription>
                  Wong Kar-wai · Hong Kong Cinema (1994)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-text leading-relaxed line-clamp-3">
                  Two interconnected stories about heartbroken Hong Kong
                  policemen falling in love: one with a mysterious underworld
                  figure, and another with a quirky snack-bar worker.
                </p>
                <CardDivider />
                <EditorialMetadata
                  items={["Criterion Collection", "Rewatched 3x", "4K Remaster"]}
                />
              </CardContent>
              <CardFooter className="justify-between border-t border-border pt-4">
                <span className="text-xs text-text-muted">Favorite</span>
                <Badge variant="caramel" size="sm" dot dotColor="caramel">
                  Completed
                </Badge>
              </CardFooter>
            </Card>

            {/* 3. Interactive media log card */}
            <Card
              variant="interactive"
              className="flex flex-col justify-between"
            >
              <CardHeader>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span className="uppercase tracking-wider font-medium text-[11px]">
                    Interactive Card
                  </span>
                  <span>Hover to test lift</span>
                </div>
                <CardTitle>Shadow of the Colossus</CardTitle>
                <CardDescription>
                  Team Ico · Video Game (2005)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-text leading-relaxed line-clamp-3">
                  A solitary young man named Wander travels into an expansive
                  forbidden realm on horseback to defeat sixteen colossal
                  beings and restore a maiden&apos;s life.
                </p>
                <CardDivider />
                <EditorialMetadata
                  items={["PlayStation", "Completed", "Atmospheric"]}
                />
              </CardContent>
              <CardFooter className="justify-between border-t border-border pt-4">
                <span className="text-xs text-accent font-medium">
                  View Entry →
                </span>
                <Badge variant="subtle" size="sm">
                  Masterpiece
                </Badge>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* 5. Component Library: Badge & Editorial Metadata */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Badge & Editorial Metadata
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Zero-pill discipline: quiet subtle tags, micro-dots, and
                typographic mid-dot separators
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted">
              src/components/ui/Badge.tsx
            </span>
          </div>

          <div className="p-6 rounded-lg bg-surface border border-border space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-3">
                Discrete Editorial Badges (Restrained Milk-Foam, Caramel & Sage)
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="subtle">Subtle Milk-Foam</Badge>
                <Badge variant="caramel">Caramel Accent</Badge>
                <Badge variant="sage">Sage Highlight</Badge>
                <Badge variant="outline">Hairline Outline</Badge>
                <Badge variant="caramel" dot dotColor="caramel">
                  Planned
                </Badge>
                <Badge variant="sage" dot dotColor="sage">
                  In Progress
                </Badge>
                <Badge variant="subtle" dot dotColor="muted">
                  Archived
                </Badge>
              </div>
            </div>

            <CardDivider />

            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-3">
                Zero-Pill Editorial Metadata (Inline Unboxed Text with Separators)
              </p>
              <div className="space-y-2 p-4 rounded bg-bg/50 border border-border/60">
                <EditorialMetadata
                  items={[
                    "Movies",
                    "The Holdovers (2023)",
                    "Alexander Payne",
                    "Winter Holiday",
                    "Rated 88/100",
                  ]}
                />
                <EditorialMetadata
                  items={[
                    "TV Shows",
                    "Severance Season 2",
                    "Apple TV+",
                    "Episode 7 of 10",
                    "Currently Watching",
                  ]}
                />
                <EditorialMetadata
                  items={[
                    "Video Games",
                    "Disco Elysium: The Final Cut",
                    "ZA/UM",
                    "42 Hours Played",
                    "Completed",
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 6. Component Library: Input */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Input Component
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Labels, helper text, error states, and search adornments
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted">
              src/components/ui/Input.tsx
            </span>
          </div>

          <div className="p-6 rounded-lg bg-surface border border-border space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Search with Start Icon */}
              <Input
                label="Search Media Catalogue"
                placeholder="Search movies, shows, books, games..."
                startIcon={<Search className="w-4 h-4" />}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                helperText="Searches TMDB, Google Books, and IGDB simultaneously"
              />

              {/* Standard Input with End Action */}
              <Input
                label="Custom List Title"
                defaultValue="Rainy Afternoon Retrospectives"
                helperText="Visible to your profile and friends"
                endIcon={<Check className="w-4 h-4 text-accent-secondary" />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Error State */}
              <Input
                label="Rating Score (0–100)"
                value={errorInputValue}
                onChange={(e) => setErrorInputValue(e.target.value)}
                errorMessage="Rating must be a valid numeric score between 0 and 100"
              />

              {/* Disabled State */}
              <Input
                label="Sync Status (System Locked)"
                disabled
                defaultValue="Scheduled: Nightly pg_cron aggregation"
                helperText="Auto-computed every evening at midnight"
              />
            </div>
          </div>
        </section>

        {/* 7. Four Media Types Quick Preview: Movies, TV, Games, Books */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Four Media Horizons
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                How the design tokens adapt consistently across all four media types
              </p>
            </div>
            <span className="text-xs text-text-muted">meDiary Scope</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Movies */}
            <div className="p-5 rounded-lg bg-surface border border-border space-y-3 shadow-2xs">
              <div className="w-8 h-8 rounded bg-accent/15 text-accent flex items-center justify-center">
                <Film className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-text">
                Movies
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                TMDB integration with director retrospectives, watch providers,
                and runtime logs.
              </p>
            </div>

            {/* TV Shows */}
            <div className="p-5 rounded-lg bg-surface border border-border space-y-3 shadow-2xs">
              <div className="w-8 h-8 rounded bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
                <Tv className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-text">
                TV Shows
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Episodic and seasonal progress tracking with air-date alerts and
                rewatch counters.
              </p>
            </div>

            {/* Video Games */}
            <div className="p-5 rounded-lg bg-surface border border-border space-y-3 shadow-2xs">
              <div className="w-8 h-8 rounded bg-accent/15 text-accent flex items-center justify-center">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-text">
                Video Games
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                IGDB/RAWG metadata tracking hours played, platforms, completion
                percentages, and backlogs.
              </p>
            </div>

            {/* Books */}
            <div className="p-5 rounded-lg bg-surface border border-border space-y-3 shadow-2xs">
              <div className="w-8 h-8 rounded bg-accent-secondary/15 text-accent-secondary flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-text">
                Books
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Google Books and Open Library sync with page progress, editions,
                and favorite quotations.
              </p>
            </div>
          </div>
        </section>

        {/* Footer: Quiet & Editorial */}
        <footer className="pt-8 pb-16 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold text-text">meDiary</span>
            <span>·</span>
            <span>Slow coffee-shop morning aesthetic</span>
            <span>·</span>
            <span>Phase 1 Design Foundation</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px]">
              prefers-reduced-motion: active
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
