"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, AlertCircle, CheckCircle2, ArrowRight, BookMarked } from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/diary";

  const {
    user,
    isLoading: isAuthLoading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    demoSignIn,
    isConfigured,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect to intended target (e.g., /diary)
  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace(redirectTo);
    }
  }, [user, isAuthLoading, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const res = await signInWithEmail(email, password);
        if (res.error) {
          setError(res.error.message);
        } else {
          router.replace(redirectTo);
        }
      } else {
        const res = await signUpWithEmail(email, password, displayName);
        if (res.error) {
          setError(res.error.message);
        } else {
          setInfoMessage("Verification link sent! Check your email to finish creating your account.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setError(res.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Sign-In failed");
    }
  };

  const handleDemoSignIn = () => {
    demoSignIn("Claire Beauchamp", "claire@mediary.app");
    router.replace(redirectTo);
  };

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full px-4 py-8 sm:py-16">
      <Card variant="default" className="border-border/80 card-depth">
        <CardHeader className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-accent/15 text-accent mx-auto flex items-center justify-center mb-1">
            <BookMarked className="w-6 h-6" />
          </div>
          <CardTitle className="font-serif text-2xl sm:text-3xl font-bold text-text">
            {mode === "login" ? "Sign in to meDiary" : "Begin your media diary"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-text-muted">
            {mode === "login"
              ? "Access your personal log, reviews, and reading notes."
              : "Create an account to start journaling your media journey."}
          </CardDescription>

          <div className="flex bg-surface-hover/80 p-1 rounded-xl gap-1 mt-4">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-surface text-text shadow-2xs font-bold"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "signup"
                  ? "bg-surface text-text shadow-2xs font-bold"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Create Account
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-2">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {isConfigured && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 border-border/80 hover:bg-surface-hover text-xs font-medium py-2.5"
                onClick={handleGoogleSignIn}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-border"></div>
                <span className="shrink mx-3 text-[11px] text-text-muted uppercase font-mono tracking-wider">
                  Or with email
                </span>
                <div className="grow border-t border-border"></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <Input
                label="Your Name / Handle"
                placeholder="e.g. Leo Bloom"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="text-xs"
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="text-xs"
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="text-xs"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 text-xs font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : mode === "login" ? (
                "Sign In to meDiary"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Instant Demo Sign-In - rendered only when isSupabaseConfigured() is false */}
          {!isConfigured && (
            <div className="pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center text-xs py-2 text-text-muted hover:text-text border-dashed gap-1.5"
                onClick={handleDemoSignIn}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Explore as Demo User</span>
              </Button>
            </div>
          )}

          <div className="text-center pt-2">
            <Link
              href="/"
              className="text-xs text-text-muted hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              <span>Back to Home</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />
      <main className="flex-1 flex items-center justify-center">
        <Suspense
          fallback={
            <div className="flex justify-center items-center py-24">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
