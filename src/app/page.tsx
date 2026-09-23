"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Film,
  Tv,
  Gamepad2,
  Coffee,
  Bookmark,
  Sparkles,
  Heart,
  Sliders,
  Compass,
  ShieldCheck,
  UserCheck,
  Database,
  Lock,
  Edit3,
  Copy,
  CheckCircle2,
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
import { TopNav } from "@/components/navigation/TopNav";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

export default function DesignFoundationPage() {
  const { user, profile, updateProfile, isConfigured, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");

  const [simulatedLoading, setSimulatedLoading] = useState(false);
  const [buttonClickCount, setButtonClickCount] = useState(0);

  // Profile update demo state for RLS testing
  const [editBio, setEditBio] = useState(
    profile?.bio || "Sipping pourover coffee, reviewing films and books."
  );
  const [isUpdatingBio, setIsUpdatingBio] = useState(false);
  const [bioUpdateSuccess, setBioUpdateSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const toggleLoading = () => {
    setSimulatedLoading(true);
    setTimeout(() => setSimulatedLoading(false), 1600);
  };

  const handleUpdateBio = async () => {
    setIsUpdatingBio(true);
    setBioUpdateSuccess(false);
    await updateProfile({ bio: editBio });
    setIsUpdatingBio(false);
    setBioUpdateSuccess(true);
    setTimeout(() => setBioUpdateSuccess(false), 3000);
  };

  const sqlPolicySnippet = `-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Public profiles viewable by everyone, private by owner
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (default_privacy = 'public' OR auth.uid() = id);

-- 2. INSERT: Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. UPDATE: Users can only update their own row
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. DELETE: Users can only delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlPolicySnippet);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/25 selection:text-text">
      {/* Top Navigation Bar */}
      <TopNav />

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        {/* Intro Hero: Editorial & Restrained */}
        <section className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-accent font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phase 2.0 · Supabase Client, Auth & Profiles RLS</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-text leading-[1.15]">
            A calm, warm morning at the corner table.
          </h1>
          <p className="text-base sm:text-lg text-text-muted leading-relaxed font-sans">
            meDiary departs from generic SaaS design in favor of a tactile,
            coffee-table aesthetic. The app is now wired with a Supabase client
            using <code className="font-mono text-sm bg-surface px-1.5 py-0.5 rounded border border-border">@supabase/ssr</code>,
            email/password & Google OAuth sign-in, responsive top navigation with
            profile menu, and strict Row Level Security (RLS) policies for user
            profiles.
          </p>

          <EditorialMetadata
            items={[
              "@supabase/ssr App Router Client",
              "Email & Google OAuth",
              "TopNav with Search & Profile Menu",
              "Profiles Table RLS Policies",
              "Oat Beige & Espresso Tokens",
              "Fraunces & Work Sans",
            ]}
            className="pt-2"
          />
        </section>

        {/* Phase 2: Live Supabase Auth & RLS Card */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                Supabase Auth & Profiles RLS
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Authentication session state, top nav profile integration, and
                owner-only update security
              </p>
            </div>
            <Badge
              variant={isConfigured ? "sage" : "caramel"}
              size="sm"
              dot
              dotColor={isConfigured ? "sage" : "caramel"}
            >
              {isConfigured ? "Supabase Connected" : "Preview Demo Mode"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Session Status Card */}
            <Card variant="book" className="lg:col-span-1 flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span className="uppercase tracking-wider font-medium text-[11px] text-accent">
                    Session Status
                  </span>
                  <span>{user ? "Authenticated" : "Visitor"}</span>
                </div>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-accent" />
                  <span>{user ? "Signed In" : "Not Signed In"}</span>
                </CardTitle>
                <CardDescription>
                  {user
                    ? "Your session is synced between browser and Next.js server cookies."
                    : "Sign in with Email or Google to access your private media journal."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {user ? (
                  <div className="space-y-3 p-3.5 rounded-md bg-bg/60 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent text-accent-contrast font-serif font-bold text-sm flex items-center justify-center shadow-xs">
                        {(profile?.display_name || user.email || "M")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-text truncate">
                          {profile?.display_name || "Reader"}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <CardDivider />

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-muted">User ID:</span>
                        <span className="font-mono text-[11px] text-text truncate max-w-[130px]">
                          {user.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Privacy:</span>
                        <Badge variant="subtle" size="sm">
                          {profile?.default_privacy || "public"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Rating Scale:</span>
                        <span className="font-mono text-text">0–100</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-md bg-bg/50 border border-border text-center space-y-3">
                    <p className="text-xs text-text-muted">
                      Open the modal to sign in with email, register a new
                      account, or authenticate via Google OAuth.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setAuthModalMode("login");
                          setIsAuthModalOpen(true);
                        }}
                      >
                        Sign In with Email or Google
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setAuthModalMode("signup");
                          setIsAuthModalOpen(true);
                        }}
                      >
                        Create Account
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t border-border pt-4 justify-between">
                {user ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-600 dark:text-red-400"
                    onClick={signOut}
                  >
                    Sign Out
                  </Button>
                ) : (
                  <span className="text-[11px] text-text-muted">
                    No active cookies
                  </span>
                )}
                <span className="text-[11px] text-text-muted font-mono">
                  @supabase/ssr
                </span>
              </CardFooter>
            </Card>

            {/* Test RLS Update Profile Section */}
            <Card variant="editorial" className="lg:col-span-2 flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span className="uppercase tracking-wider font-medium text-[11px] text-accent-secondary">
                    Row Level Security (RLS)
                  </span>
                  <span className="flex items-center gap-1 text-accent-secondary font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Enforced by Postgres
                  </span>
                </div>
                <CardTitle className="text-xl">
                  Profiles Table RLS: Users can only write their own row
                </CardTitle>
                <CardDescription>
                  Under PostgreSQL RLS, an authenticated user’s ID (<code className="font-mono text-xs">auth.uid()</code>)
                  is matched against the profile row’s primary key. Any attempt
                  to update another user’s row is denied by the database engine.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Interactive RLS update test */}
                <div className="p-4 rounded-md bg-bg/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-text uppercase tracking-wide flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-accent" />
                      <span>Test Profile Update (Exercises UPDATE RLS Policy)</span>
                    </label>
                    {bioUpdateSuccess && (
                      <span className="text-xs text-accent-secondary flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Saved to profile!
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Write your bio..."
                      className="text-xs"
                      containerClassName="flex-1"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleUpdateBio}
                      isLoading={isUpdatingBio}
                      disabled={!user}
                      className="shrink-0"
                    >
                      Update Profile
                    </Button>
                  </div>
                  {!user && (
                    <p className="text-[11px] text-text-muted italic">
                      * Please sign in or use the demo login in the TopNav to test updating your profile.
                    </p>
                  )}
                </div>

                {/* SQL Policy Snippet View */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-text-muted" />
                      <span>Active RLS Policies (<code className="font-mono text-xs">supabase/migrations/</code>)</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyToClipboard}
                      className="text-xs h-7 px-2"
                      leftIcon={<Copy className="w-3 h-3" />}
                    >
                      {copiedSql ? "Copied!" : "Copy SQL"}
                    </Button>
                  </div>

                  <pre className="p-3.5 rounded-md bg-surface text-text border border-border text-[11px] font-mono leading-relaxed overflow-x-auto max-h-48">
                    {sqlPolicySnippet}
                  </pre>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border pt-3 justify-between text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  <span>RLS Policy: <code className="font-mono text-[11px]">auth.uid() = id</code></span>
                </div>
                <span className="text-[11px]">Migration: 20260923000000_create_profiles.sql</span>
              </CardFooter>
            </Card>
          </div>
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

        {/* 2. Component Library: Buttons */}
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

        {/* 3. Component Library: Cards */}
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

        {/* 4. Component Library: Badge & Editorial Metadata */}
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

        {/* 5. Four Media Types Quick Preview */}
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
            <span>Phase 2.0 Supabase Auth & RLS</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px]">
              RLS: auth.uid() = id
            </span>
          </div>
        </footer>
      </main>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
      />
    </div>
  );
}
