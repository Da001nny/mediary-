"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { TopNav } from "@/components/navigation/TopNav";
import { ListDetailView } from "@/components/lists/ListDetailView";
import { getListById } from "@/lib/lists";
import { Loader2, ArrowLeft, BookOpen, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ListWithItems } from "@/types/database.types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SingleListPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const listId = resolvedParams.id;

  const [list, setList] = useState<ListWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getListById(listId)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setError(res.error);
          setList(null);
        } else {
          setList(res.list);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Couldn't load list");
        setList(null);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [listId, retryKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 pb-20">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <span className="text-xs font-serif italic">Loading custom collection...</span>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-text">Couldn&apos;t load list</h2>
            <p className="text-xs text-text-muted leading-relaxed">
              We encountered an issue communicating with the database. Please check your connection and try again.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetry}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
              <Link href="/lists">
                <Button variant="secondary" size="sm">
                  Return to Lists
                </Button>
              </Link>
            </div>
          </div>
        ) : !list ? (
          <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface border border-border flex items-center justify-center text-text-muted">
              <BookOpen className="w-6 h-6 opacity-40" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-text">List not found</h2>
            <p className="text-xs text-text-muted leading-relaxed">
              The custom list you are looking for may have been removed, made private, or does not exist.
            </p>
            <div className="pt-2">
              <Link href="/lists">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                >
                  Return to Lists
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <ListDetailView initialList={list} />
        )}
      </main>
    </div>
  );
}
