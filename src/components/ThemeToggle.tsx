"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type ThemeMode = "light" | "dark" | "system";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): ThemeMode {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("mediary-theme") as ThemeMode) || "system";
}

function getServerSnapshot(): ThemeMode {
  return "system";
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    root.classList.remove("dark");
    localStorage.removeItem("mediary-theme");
  } else if (mode === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
    localStorage.setItem("mediary-theme", "dark");
  } else {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
    localStorage.setItem("mediary-theme", "light");
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const { user, updateProfile } = useAuth();
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const handleSelect = (mode: ThemeMode) => {
    applyTheme(mode);
    window.dispatchEvent(new Event("storage"));
    if (user && updateProfile) {
      updateProfile({ theme: mode }).catch((err) => {
        console.warn("Could not save theme to profile:", err);
      });
    }
  };

  return (
    <div
      role="group"
      aria-label="Color Theme Switcher"
      className={cn(
        "inline-flex items-center p-1 rounded-md bg-surface border border-border shadow-2xs gap-0.5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => handleSelect("light")}
        aria-pressed={theme === "light"}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
          theme === "light"
            ? "bg-accent text-[#0E0902] dark:text-[#0A0702] font-semibold shadow-2xs"
            : "text-text-muted hover:text-text hover:bg-surface-hover font-medium"
        )}
        title="Light: Warm Honey Wood"
      >
        <Sun className="w-3.5 h-3.5" />
        <span>Honey Wood</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect("dark")}
        aria-pressed={theme === "dark"}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
          theme === "dark"
            ? "bg-accent text-[#0E0902] dark:text-[#0A0702] font-semibold shadow-2xs"
            : "text-text-muted hover:text-text hover:bg-surface-hover font-medium"
        )}
        title="Dark: Cozy Cabin"
      >
        <Moon className="w-3.5 h-3.5" />
        <span>Cabin Dark</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect("system")}
        aria-pressed={theme === "system"}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
          theme === "system"
            ? "bg-accent text-[#0E0902] dark:text-[#0A0702] font-semibold shadow-2xs"
            : "text-text-muted hover:text-text hover:bg-surface-hover font-medium"
        )}
        title="System Preference"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>System</span>
      </button>
    </div>
  );
}
