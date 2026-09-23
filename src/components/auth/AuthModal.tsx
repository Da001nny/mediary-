"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
}

export function AuthModal({
  isOpen,
  onClose,
  defaultMode = "login",
}: AuthModalProps) {
  const [selectedMode, setSelectedMode] = useState<"login" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    demoSignIn,
    isConfigured,
  } = useAuth();

  const mode = selectedMode ?? defaultMode;

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedMode(null);
    setError(null);
    setInfoMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    if (mode === "login") {
      const res = await signInWithEmail(email, password);
      setIsSubmitting(false);
      if (res.error) {
        setError(res.error.message || "Failed to log in. Please check your credentials.");
      } else {
        handleClose();
      }
    } else {
      const res = await signUpWithEmail(email, password, displayName);
      setIsSubmitting(false);
      if (res.error) {
        setError(res.error.message || "Failed to sign up.");
      } else {
        if (!isConfigured) {
          handleClose();
        } else {
          setInfoMessage(
            "Account created! If email confirmation is enabled on your Supabase project, please check your inbox to confirm."
          );
          setTimeout(() => {
            handleClose();
          }, 3000);
        }
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    const res = await signInWithGoogle();
    setIsSubmitting(false);
    if (res.error) {
      setError(res.error.message || "Google sign in was interrupted.");
    } else if (!isConfigured) {
      handleClose();
    }
  };

  const handleDemoSignIn = () => {
    demoSignIn("Claire Beauchamp", "claire@mediary.app");
    handleClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text/30 backdrop-blur-xs motion-safe:transition-opacity"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-50 motion-safe:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <Card variant="book" className="shadow-lg border-border bg-surface">
          <CardHeader className="relative pb-4">
            <button
              onClick={handleClose}
              aria-label="Close modal"
              className="absolute right-4 top-4 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent font-medium mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>meDiary Reader Access</span>
            </div>

            <CardTitle id="auth-modal-title" className="text-2xl font-serif">
              {mode === "login" ? "Welcome back" : "Begin your media diary"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to log movies, TV, games, and books over slow mornings."
                : "Create your personal space for thoughtful media reviews and lists."}
            </CardDescription>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 mt-4 rounded-md bg-bg/70 border border-border">
              <button
                type="button"
                onClick={() => {
                  setSelectedMode("login");
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  mode === "login"
                    ? "bg-surface text-text shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMode("signup");
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  mode === "signup"
                    ? "bg-surface text-text shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Create Account
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="secondary"
              className="w-full h-11 border-border/80 hover:border-accent/40 font-medium"
              onClick={handleGoogleSignIn}
              isLoading={isSubmitting}
              leftIcon={
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              }
            >
              Continue with Google
            </Button>

            {/* Hairline Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative px-3 bg-surface text-[11px] uppercase tracking-wider text-text-muted font-mono">
                or with email
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Info Message */}
            {infoMessage && (
              <div className="p-3 rounded-md bg-accent-secondary/15 border border-accent-secondary/30 text-accent-secondary text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <Input
                  label="Display Name"
                  placeholder="e.g. Claire Beauchamp"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              )}

              <Input
                label="Email"
                type="email"
                placeholder="reader@mediary.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full h-10 mt-2 font-medium"
                isLoading={isSubmitting}
              >
                {mode === "login" ? "Sign In to meDiary" : "Create My Account"}
              </Button>
            </form>

            {/* Preview notice if env vars not yet configured */}
            {!isConfigured && (
              <div className="p-3 mt-3 rounded-md bg-accent/10 border border-accent/25 text-text space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-accent">
                    Preview Demo Mode
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Supabase environment variables can be configured in{" "}
                  <code className="text-text font-mono">.env.local</code>. You
                  can sign in instantly with a sample reviewer account to test
                  the authenticated interface:
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleDemoSignIn}
                >
                  Quick Sign In as Demo Reviewer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
