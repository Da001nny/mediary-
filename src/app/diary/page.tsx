import React, { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/TopNav";
import { DiaryView } from "@/components/diary/DiaryView";
import { DiaryGridSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "My Media Diary — meDiary",
  description:
    "Log, review, and filter your movies, television shows, and books over slow mornings.",
};

export default async function DiaryPage() {
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-12 lg:py-14 w-full">
        <Suspense
          fallback={
            <div className="space-y-6 sm:space-y-10 lg:space-y-14">
              <div className="p-4 sm:p-8 lg:p-12 rounded-2xl sm:rounded-3xl card-depth space-y-4 animate-pulse">
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
