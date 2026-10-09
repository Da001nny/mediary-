"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  Search,
  RefreshCw,
  Layers,
  Cpu,
  Globe,
  ExternalLink,
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
import { MediaSearchModal } from "@/components/media/MediaSearchModal";

export default function DevPanelsClient() {
  const { user, profile, updateProfile, isConfigured, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Media sync testing state
  const [syncTestId, setSyncTestId] = useState("550");
  const [syncTestType, setSyncTestType] = useState<"movie" | "tv" | "game">("movie");
  const [isSyncTesting, setIsSyncTesting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [syncTestResult, setSyncTestResult] = useState<any>(null);
  const [syncTestError, setSyncTestError] = useState<string | null>(null);

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

  const handleTestSync = async (idToSync?: string, typeToSync?: "movie" | "tv" | "game") => {
    const targetId = idToSync || syncTestId;
    const targetType = typeToSync || syncTestType;

    setIsSyncTesting(true);
    setSyncTestError(null);
    setSyncTestResult(null);

    try {
      const endpoint = targetType === "game" ? "/api/games/sync" : "/api/tmdb/sync";
      const payload =
        targetType === "game"
          ? { id: targetId }
          : { id: Number(targetId), type: targetType };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Sync request failed");
      }
      setSyncTestResult(data);
    } catch (err: unknown) {
      setSyncTestError(
        err instanceof Error ? err.message : "Failed to sync media item"
      );
    } finally {
      setIsSyncTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/25 selection:text-text">
      {/* Top Navigation Bar */}
      <TopNav />

      {/* Main Content Area with generous desktop breathing room */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-16 space-y-12 sm:space-y-20">
        {/* Intro Hero: Editorial & Restrained */}
        <section className="space-y-4 sm:space-y-5 max-w-4xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-accent font-bold font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Developer Sandbox & Diagnostics (/dev)</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-text leading-[1.12]">
            meDiary Developer & Design Panels
          </h1>
          <p className="text-base sm:text-lg text-text-muted leading-relaxed font-sans">
            Administrative diagnostic suite: design token swatches, component showcase,
            TMDB & RAWG live sync testers, Supabase auth/RLS policy verification, and
            architectural technical specifications.
          </p>

          <EditorialMetadata
            items={[
              "@supabase/ssr App Router Client",
              "Email & Google OAuth",
              "TopNav with Search & Profile Menu",
              "Profiles Table RLS Policies",
              "Cozy Cabin Palette (Honey Wood, Matte Charcoal, Amber & Forest Green)",
              "Fraunces & Work Sans",
            ]}
            className="pt-2"
          />
        </section>

        {/* Phase 3: TMDB Integration & Media Catalog */}
        <section className="space-y-6">
          <div className="border-b border-border pb-3 flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-accent font-medium mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Phase 3.0</span>
              </div>
              <h2 className="font-serif text-2xl font-semibold text-text">
                TMDB Search & Media Table Upsert
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Fetch full TMDB metadata (cast, crew, watch providers, last_synced_at) and upsert into the public.media table
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSearchModalOpen(true)}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                Launch TMDB Search (⌘K)
              </Button>
            </div>
          </div>

          {/* Tradeoff Explanation Card: Next.js API Route vs Supabase Edge Function */}
          <Card variant="book" className="bg-surface/80 border-border">
            <CardHeader>
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span className="uppercase tracking-wider font-mono text-[11px] text-accent">
                  Architectural Evaluation
                </span>
                <span className="font-mono text-[11px]">Next.js API Route vs. Supabase Edge Function</span>
              </div>
              <CardTitle className="text-lg">Tradeoff Summary</CardTitle>
              <CardDescription>
                We implemented the Next.js API Route architecture (<code className="font-mono text-xs bg-bg px-1 py-0.5 rounded border border-border">/api/tmdb/sync</code> and <code className="font-mono text-xs bg-bg px-1 py-0.5 rounded border border-border">/api/tmdb/search</code>) while also providing the ready-to-deploy Supabase Edge Function in <code className="font-mono text-xs bg-bg px-1 py-0.5 rounded border border-border">supabase/functions/sync-media/index.ts</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg border border-border bg-bg/50 space-y-2">
                  <div className="flex items-center gap-2 text-text font-semibold">
                    <Globe className="w-4 h-4 text-accent" />
                    <span>Next.js API Route (Active)</span>
                  </div>
                  <ul className="space-y-1.5 text-text-muted list-disc list-inside">
                    <li><strong className="text-text">Shared TypeScript Types:</strong> Shares exact types (<code className="font-mono text-[11px]">MediaItem</code>, <code className="font-mono text-[11px]">WatchProvidersCountry</code>, <code className="font-mono text-[11px]">CastMember</code>) with the app without duplicate declarations.</li>
                    <li><strong className="text-text">Zero Additional CLI Setup:</strong> Runs immediately within the Next.js container, utilizing Next.js cookies and environment variables seamlessly.</li>
                    <li><strong className="text-text">Same-Origin:</strong> No cross-origin CORS overhead or client JWT token forwarding hurdles.</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg border border-border bg-bg/50 space-y-2">
                  <div className="flex items-center gap-2 text-text font-semibold">
                    <Cpu className="w-4 h-4 text-accent-secondary" />
                    <span>Supabase Edge Function (Template Included)</span>
                  </div>
                  <ul className="space-y-1.5 text-text-muted list-disc list-inside">
                    <li><strong className="text-text">Database Proximity:</strong> Deno edge workers positioned geographically close to the Supabase Postgres instance.</li>
                    <li><strong className="text-text">Decoupled Workloads:</strong> Can be triggered asynchronously via Postgres Database Webhooks or pg_cron schedules without consuming web server compute.</li>
                    <li><strong className="text-text">Tradeoff:</strong> Requires separate <code className="font-mono text-[11px]">supabase functions deploy</code> deployment and Deno secrets management.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Live Sync Tester */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card variant="book" className="lg:col-span-1 space-y-4 flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-accent" />
                    <span>Live Upsert Tester</span>
                  </CardTitle>
                  <CardDescription>
                    Trigger TMDB detail fetch + public.media table upsert with last_synced_at.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preset quick buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
                      Quick Sample Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSyncTestId("550");
                          setSyncTestType("movie");
                          handleTestSync("550", "movie");
                        }}
                        className="px-2 py-1 text-xs rounded bg-surface border border-border hover:border-accent text-text transition-colors cursor-pointer"
                      >
                        Fight Club (550)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSyncTestId("95557");
                          setSyncTestType("tv");
                          handleTestSync("95557", "tv");
                        }}
                        className="px-2 py-1 text-xs rounded bg-surface border border-border hover:border-accent text-text transition-colors cursor-pointer"
                      >
                        Severance (95557)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSyncTestId("94605");
                          setSyncTestType("tv");
                          handleTestSync("94605", "tv");
                        }}
                        className="px-2 py-1 text-xs rounded bg-surface border border-border hover:border-accent text-text transition-colors cursor-pointer"
                      >
                        Arcane (94605)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSyncTestId("3498");
                          setSyncTestType("game");
                          handleTestSync("3498", "game");
                        }}
                        className="px-2 py-1 text-xs rounded bg-accent/15 border border-accent/40 text-accent font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Gamepad2 className="w-3 h-3" /> Elden Ring (3498)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSyncTestId("452634");
                          setSyncTestType("game");
                          handleTestSync("452634", "game");
                        }}
                        className="px-2 py-1 text-xs rounded bg-surface border border-border hover:border-accent text-text transition-colors cursor-pointer"
                      >
                        Baldur&apos;s Gate 3 (452634)
                      </button>
                    </div>
                  </div>

                  {/* Custom ID input */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] font-mono text-text-muted mb-1 block">
                          {syncTestType === "game" ? "RAWG ID" : "TMDB ID"}
                        </label>
                        <Input
                          type="number"
                          value={syncTestId}
                          onChange={(e) => setSyncTestId(e.target.value)}
                          placeholder={syncTestType === "game" ? "e.g. 3498" : "e.g. 550"}
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-[11px] font-mono text-text-muted mb-1 block">
                          Type
                        </label>
                        <select
                          value={syncTestType}
                          onChange={(e) => setSyncTestType(e.target.value as "movie" | "tv" | "game")}
                          className="w-full h-10 px-2 rounded-md bg-surface text-text border border-border text-xs focus:ring-1 focus:ring-ring outline-none"
                        >
                          <option value="movie">Movie</option>
                          <option value="tv">TV Show</option>
                          <option value="game">Video Game</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full justify-center"
                      disabled={isSyncTesting || !syncTestId}
                      onClick={() => handleTestSync()}
                      leftIcon={
                        isSyncTesting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Layers className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {isSyncTesting ? "Fetching & Upserting..." : "Sync to `media` Table"}
                    </Button>
                  </div>
                </CardContent>
              </div>

              {syncTestError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-md mx-6 mb-6">
                  {syncTestError}
                </div>
              )}
            </Card>

            {/* Results Preview Card */}
            <Card variant="default" className="lg:col-span-2 flex flex-col justify-between overflow-hidden">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Database className="w-4 h-4 text-accent" />
                    <span>Upserted Record / Response Payload</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {syncTestResult?.media?.id && (
                      <Link
                        href={`/media/${syncTestResult.media.id}`}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-accent text-accent-contrast text-xs font-semibold rounded-lg hover:bg-accent-hover transition-colors shadow-xs"
                      >
                        <span>Open Title Page</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    {syncTestResult && (
                      <Badge variant="forest" size="sm">
                        {syncTestResult.persisted ? "Persisted in Supabase" : "Live Payload Ready"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-surface font-mono text-[11px] overflow-auto max-h-[360px]">
                {syncTestResult ? (
                  <pre className="p-4 text-text-muted leading-relaxed">
                    {JSON.stringify(syncTestResult, null, 2)}
                  </pre>
                ) : (
                  <div className="p-8 text-center text-text-muted space-y-2">
                    <p>Select a quick sample above or enter any TMDB or RAWG ID to test the sync endpoint.</p>
                    <p className="text-[10px]">
                      Endpoints: <code className="text-text">POST /api/tmdb/sync</code> and <code className="text-text">POST /api/games/sync</code>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Title Jump: Featured Media Titles (Movies, TV & Video Games) */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-text flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-accent" />
                <span>Featured Catalog Titles & Game Pages</span>
              </h3>
              <Link
                href="/diary"
                className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1"
              >
                <span>View My Diary</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  id: "game-3498",
                  title: "Elden Ring",
                  year: "2022",
                  type: "game",
                  subtitle: "FromSoftware · RPG",
                  badge: "Game",
                },
                {
                  id: "game-452634",
                  title: "Baldur's Gate 3",
                  year: "2023",
                  type: "game",
                  subtitle: "Larian · CRPG",
                  badge: "Game",
                },
                {
                  id: "game-326243",
                  title: "Zelda: Tears of Kingdom",
                  year: "2023",
                  type: "game",
                  subtitle: "Nintendo · Adventure",
                  badge: "Game",
                },
                {
                  id: "game-654",
                  title: "Stardew Valley",
                  year: "2016",
                  type: "game",
                  subtitle: "ConcernedApe · Sim",
                  badge: "Game",
                },
                {
                  id: "movie-550",
                  title: "Fight Club",
                  year: "1999",
                  type: "movie",
                  subtitle: "David Fincher",
                  badge: "Movie",
                },
                {
                  id: "tv-95557",
                  title: "Severance",
                  year: "2022",
                  type: "tv",
                  subtitle: "Apple TV+ · S1 & S2",
                  badge: "TV Series",
                },
              ].map((item) => (
                <Link
                  key={item.id}
                  href={`/media/${item.id}`}
                  className="group p-3 rounded-lg bg-surface border border-border hover:border-accent/60 transition-all flex flex-col justify-between space-y-2 hover:shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1">
                    <Badge
                      variant={item.type === "game" ? "subtle" : item.type === "movie" ? "amber" : "forest"}
                      size="sm"
                      className="text-[9px] uppercase tracking-wider"
                    >
                      {item.badge}
                    </Badge>
                    <span className="text-[10px] font-mono text-text-muted">{item.year}</span>
                  </div>

                  <div>
                    <h4 className="font-serif text-sm font-bold text-text group-hover:text-accent transition-colors line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>

                  <span className="text-[10px] font-medium text-accent inline-flex items-center gap-1 pt-1">
                    <span>Open Title Page</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
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
              variant={isConfigured ? "forest" : "amber"}
              size="sm"
              dot
              dotColor={isConfigured ? "forest" : "amber"}
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
                      leftIcon={<Copy className="w-3.5 h-3.5" />}
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
            {/* Honey Wood */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-bg)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">--color-bg</p>
                <p className="text-[11px] text-text-muted">Honey Wood Background</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #D9B98A / #1B1714
                </p>
              </div>
            </div>

            {/* Warm Wood Surface */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-surface)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-surface
                </p>
                <p className="text-[11px] text-text-muted">Polished Pine Surface</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #E8D4AE / #26211C
                </p>
              </div>
            </div>

            {/* Matte Charcoal */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-text)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">--color-text</p>
                <p className="text-[11px] text-text-muted">Warm Charcoal Text</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #241F1B / #F5EBD9
                </p>
              </div>
            </div>

            {/* Muted Charcoal / Woodsmoke */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-text-muted)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-text-muted
                </p>
                <p className="text-[11px] text-text-muted">Warm Brown-Grey</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #544638 / #A99F90
                </p>
              </div>
            </div>

            {/* Amber Accent */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-accent
                </p>
                <p className="text-[11px] text-text-muted">Glowing Amber</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #D98F3C / #E28B2A
                </p>
              </div>
            </div>

            {/* Forest Green */}
            <div className="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between space-y-3 shadow-2xs">
              <div
                className="w-full h-12 rounded border border-border"
                style={{ backgroundColor: "var(--color-accent-secondary)" }}
              />
              <div>
                <p className="text-xs font-semibold text-text">
                  --color-accent-secondary
                </p>
                <p className="text-[11px] text-text-muted">Forest Green</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  #4F6146 / #529369
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
                Variants (Primary Amber, Secondary Wood, Forest Highlight, Outline, Ghost)
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="primary"
                  leftIcon={<Bookmark className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Primary Amber
                </Button>

                <Button
                  variant="secondary"
                  leftIcon={<Coffee className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Secondary Wood
                </Button>

                <Button
                  variant="forest"
                  leftIcon={<Heart className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Forest Green Highlight
                </Button>

                <Button
                  variant="outline"
                  leftIcon={<Compass className="w-4 h-4" />}
                  onClick={() => setButtonClickCount((c) => c + 1)}
                >
                  Amber Outline
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
                  Sizes (sm: 36px, md: 42px, lg: 50px)
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
                <Badge variant="forest" size="sm" dot dotColor="forest">
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
                <Badge variant="amber" size="sm" dot dotColor="amber">
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
                Discrete Editorial Badges (Restrained Honey Wood, Amber & Forest Green)
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="subtle">Subtle Wood</Badge>
                <Badge variant="amber">Amber Accent</Badge>
                <Badge variant="forest">Forest Green Highlight</Badge>
                <Badge variant="outline">Hairline Outline</Badge>
                <Badge variant="amber" dot dotColor="amber">
                  Planned
                </Badge>
                <Badge variant="forest" dot dotColor="forest">
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
            <span>Developer Sandbox (/dev)</span>
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

      {/* Global TMDB Search & Sync Modal */}
      <MediaSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onMediaSynced={(media) => {
          setSyncTestResult({ success: true, persisted: true, media });
        }}
      />
    </div>
  );
}
