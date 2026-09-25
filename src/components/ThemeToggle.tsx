"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const handleSelect = (mode: ThemeMode) => {
    applyTheme(mode);
    window.dispatchEvent(new Event("storage"));
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
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
          theme === "light"
            ? "bg-accent text-accent-contrast shadow-2xs"
            : "text-text-muted hover:text-text hover:bg-surface-hover"
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
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
          theme === "dark"
            ? "bg-accent text-accent-contrast shadow-2xs"
            : "text-text-muted hover:text-text hover:bg-surface-hover"
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
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors duration-150 motion-reduce:transition-none cursor-pointer",
          theme === "system"
            ? "bg-accent text-accent-contrast shadow-2xs"
            : "text-text-muted hover:text-text hover:bg-surface-hover"
        )}
        title="System Preference"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>System</span>
      </button>
    </div>
  );
}
