import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md skeleton-shimmer ring-1 ring-border/50",
        className
      )}
      {...props}
    />
  );
}

export function PosterSkeleton({
  className,
  aspect = "poster",
}: {
  className?: string;
  aspect?: "poster" | "square" | "video";
}) {
  const aspectClass = {
    poster: "aspect-2/3",
    square: "aspect-square",
    video: "aspect-video",
  }[aspect];

  return (
    <div
      className={cn(
        "rounded-2xl skeleton-shimmer poster-depth ring-1 ring-black/10 dark:ring-white/10 shrink-0",
        aspectClass,
        className
      )}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "p-6 sm:p-8 rounded-2xl card-depth space-y-5",
        className
      )}
    >
      <div className="flex gap-5 items-start">
        <Skeleton className="w-24 sm:w-28 aspect-2/3 rounded-xl poster-depth-sm shrink-0" />
        <div className="flex-1 space-y-3 pt-1">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

export function DiaryGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SearchHitsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 p-4 rounded-xl card-depth items-start"
        >
          <Skeleton className="w-20 h-28 rounded-lg poster-depth-sm shrink-0" />
          <div className="flex-1 space-y-2.5 min-w-0 pt-0.5">
            <Skeleton className="h-5 w-4/5 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-10 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MediaHeaderSkeleton() {
  return (
    <div className="relative overflow-hidden bg-surface border-b border-border py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <Skeleton className="h-4 w-32 rounded" />
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
          <PosterSkeleton className="w-48 sm:w-64 md:w-72 lg:w-80" />
          <div className="flex-1 space-y-4 w-full">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-10 sm:h-12 w-4/5 rounded-lg" />
            <Skeleton className="h-5 w-2/3 rounded" />
            <div className="flex items-center gap-4 py-3 border-y border-border/70">
              <Skeleton className="h-6 w-20 rounded" />
              <Skeleton className="h-5 w-36 rounded" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
