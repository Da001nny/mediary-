"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Database,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getAlgoliaClientConfig } from "@/lib/algolia";

interface AlgoliaStatusData {
  appIdConfigured: boolean;
  searchKeyConfigured: boolean;
  adminKeyConfigured: boolean;
  indexName: string;
  mediaRecordsInDatabase: number;
  readyForSearch: boolean;
  readyForBackfill: boolean;
}

export function AlgoliaStatusCard({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<AlgoliaStatusData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean;
    message?: string;
    totalIndexed?: number;
    indexName?: string;
    error?: string;
  } | null>(null);

  const clientConfig = getAlgoliaClientConfig();

  const refreshStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/algolia/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn("Could not fetch Algolia status:", err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadInitialStatus() {
      try {
        const res = await fetch("/api/admin/algolia/status");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.warn("Could not fetch Algolia status:", err);
      }
    }
    loadInitialStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRunBackfill = async () => {
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/algolia/backfill", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Backfill failed");
      }
      setBackfillResult({
        success: true,
        message: data.message,
        totalIndexed: data.totalIndexed,
        indexName: data.indexName,
      });
      // Refresh count
      refreshStatus();
    } catch (err: unknown) {
      setBackfillResult({
        success: false,
        error: err instanceof Error ? err.message : "Backfill request failed",
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const isConnected =
    status?.readyForSearch ||
    status?.readyForBackfill ||
    clientConfig.isConfigured;

  return (
    <div
      className={`p-3.5 sm:p-7 lg:p-9 rounded-2xl bg-surface border border-border/80 card-depth space-y-4 sm:space-y-7 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3.5 sm:pb-5">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent text-accent-contrast flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-lg sm:text-2xl font-bold text-text">
              Algolia Search & Catalog Indexing
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
            Real-time typo-tolerant catalog search with automated Postgres triggers and Supabase Edge Functions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <button
            type="button"
            onClick={refreshStatus}
            disabled={isLoadingStatus}
            title="Refresh status"
            className="p-1.5 sm:p-2 rounded-xl border border-border hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingStatus ? "animate-spin text-accent" : ""}`}
            />
          </button>
          <Badge
            variant={isConnected ? "forest" : "amber"}
            size="md"
            className="shrink-0 text-[10px] sm:text-xs font-semibold py-1 px-2 sm:px-3"
          >
            {isConnected ? "Algolia Connected" : "Algolia Pending Setup"}
          </Badge>
        </div>
      </div>

      {/* Algolia Configuration Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
        {/* App ID */}
        <div className="p-4 rounded-xl bg-bg/50 border border-border/80 card-depth-hover transition-all space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Application ID
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {status?.appIdConfigured || clientConfig.appId ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {clientConfig.appId
                    ? `${clientConfig.appId.slice(0, 4)}••••`
                    : "Configured"}
                </span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Not set in env</span>
              </span>
            )}
          </div>
        </div>

        {/* Search-Only Key */}
        <div className="p-4 rounded-xl bg-bg/50 border border-border/80 card-depth-hover transition-all space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Search API Key (Client)
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {status?.searchKeyConfigured || clientConfig.searchApiKey ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {clientConfig.searchApiKey
                    ? `${clientConfig.searchApiKey.slice(0, 4)}••••`
                    : "Configured"}
                </span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Not set in env</span>
              </span>
            )}
          </div>
        </div>

        {/* Admin API Key (Server) */}
        <div className="p-4 rounded-xl bg-bg/50 border border-border/80 card-depth-hover transition-all space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Admin API Key (Server)
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {status?.adminKeyConfigured ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Configured (Server)</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Pending in env</span>
              </span>
            )}
          </div>
        </div>

        {/* Index Name & DB records */}
        <div className="p-4 rounded-xl bg-bg/50 border border-border/80 card-depth-hover transition-all space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-text-muted font-bold block">
            Target Index & Database
          </span>
          <div className="flex items-center gap-1.5 font-mono text-xs text-text font-semibold truncate">
            <Database className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">
              {status?.indexName || clientConfig.indexName}
            </span>
          </div>
          {status?.mediaRecordsInDatabase !== undefined && (
            <span className="text-[10px] text-text-muted block font-mono">
              {status.mediaRecordsInDatabase} titles in database
            </span>
          )}
        </div>
      </div>

      {/* Backfill Trigger Section */}
      <div className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-elevated/40 space-y-3 sm:space-y-4 card-depth-hover">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-accent" />
              <span>Run Algolia Catalog Backfill</span>
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-xl">
              Bulk-indexes every existing row in the{" "}
              <code className="font-mono text-xs bg-bg px-1.5 py-0.5 rounded border border-border">
                media
              </code>{" "}
              table into Algolia, so titles synced before this change become instantly searchable.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isBackfilling}
            onClick={handleRunBackfill}
            className="w-full sm:w-auto shrink-0 gap-2 text-xs font-semibold h-9 sm:h-10 px-3.5 sm:px-5 shadow-xs hover:shadow-md cursor-pointer justify-center"
          >
            {isBackfilling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Indexing Rows...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Run Algolia Catalog Backfill</span>
              </>
            )}
          </Button>
        </div>

        {/* Backfill Result Feedback Banner */}
        {backfillResult && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in ${
              backfillResult.success
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400"
            }`}
          >
            {backfillResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 leading-relaxed min-w-0">
              <strong className="block font-semibold">
                {backfillResult.success ? "Backfill Complete" : "Backfill Failed"}
              </strong>
              <span className="break-words">
                {backfillResult.message || backfillResult.error}
              </span>
              {backfillResult.totalIndexed !== undefined && (
                <span className="block font-mono text-[11px] mt-1 font-semibold">
                  Indexed: {backfillResult.totalIndexed} items into &apos;
                  {backfillResult.indexName}&apos;
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Developer Reference Snippet */}
      <div className="p-3.5 rounded-lg bg-bg/60 border border-border/80 space-y-2 text-xs text-text-muted overflow-hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold text-text">
            <Terminal className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate">CLI, API & Database Integration Details</span>
          </div>
          <a
            href="/api/admin/algolia/status"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Raw Status API</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <ul className="space-y-1.5 font-mono text-[11px] list-disc list-inside text-text-muted">
          <li className="break-words">
            <strong className="text-text">CLI Command:</strong>{" "}
            <code className="bg-surface px-1.5 py-0.5 rounded border border-border break-all">
              npm run algolia:backfill
            </code>
          </li>
          <li className="break-words">
            <strong className="text-text">Admin API Route:</strong>{" "}
            <code className="bg-surface px-1.5 py-0.5 rounded border border-border break-all">
              POST /api/admin/algolia/backfill
            </code>
          </li>
          <li className="break-words">
            <strong className="text-text">Postgres Trigger:</strong>{" "}
            <code className="bg-surface px-1.5 py-0.5 rounded border border-border break-all">
              AFTER INSERT OR UPDATE ON public.media
            </code>
          </li>
          <li className="break-words">
            <strong className="text-text">Supabase Edge Function:</strong>{" "}
            <code className="bg-surface px-1.5 py-0.5 rounded border border-border break-all">
              supabase/functions/algolia-sync
            </code>
          </li>
        </ul>
      </div>
    </div>
  );
}
