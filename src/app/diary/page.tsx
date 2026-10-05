import React, { Suspense } from "react";
import type { Metadata } from "next";
import { TopNav } from "@/components/navigation/TopNav";
import { DiaryView } from "@/components/diary/DiaryView";
import { DiaryGridSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "My Media Diary — meDiary",
  description:
    "Log, review, and filter your movies, television shows, and books over slow mornings.",
};

export default function DiaryPage() {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-14 w-full">
        <Suspense
          fallback={
            <div className="space-y-10 sm:space-y-14">
              <div className="p-8 sm:p-12 rounded-3xl card-depth space-y-4 animate-pulse">
                <div className="h-4 w-36 rounded bg-surface-hover/60" />
                <div className="h-10 sm:h-12 w-3/5 rounded-lg bg-surface-hover/60" />
                <div className="h-4 w-4/5 rounded bg-surface-hover/60" />
              </div>
              <DiaryGridSkeleton count={6} />
            </div>
          }
        >
          <DiaryView />
        </Suspense>
      </main>
    </div>
  );
}
