import React, { Suspense } from "react";
import type { Metadata } from "next";
import { TopNav } from "@/components/navigation/TopNav";
import { DiaryView } from "@/components/diary/DiaryView";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "My Media Diary — meDiary",
  description:
    "Log, review, and filter your movies, television shows, and books over slow mornings.",
};

export default function DiaryPage() {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Suspense
          fallback={
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-text-muted">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-xs">Opening your media diary...</p>
            </div>
          }
        >
          <DiaryView />
        </Suspense>
      </main>
    </div>
  );
}
