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
      className={`p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent text-accent-contrast flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-serif text-lg font-bold text-text">
              Algolia Search & Catalog Indexing
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Real-time typo-tolerant catalog search with automated Postgres triggers and Supabase Edge Functions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={refreshStatus}
            disabled={isLoadingStatus}
            title="Refresh status"
            className="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin text-accent" : ""}`}
            />
          </button>
          <Badge
            variant={isConnected ? "forest" : "amber"}
            size="sm"
            className="shrink-0 text-[11px]"
          >
            {isConnected ? "Algolia Connected" : "Algolia Pending Setup"}
          </Badge>
        </div>
      </div>

      {/* Algolia Configuration Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* App ID */}
        <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted block">
            Application ID
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {status?.appIdConfigured || clientConfig.appId ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>
                  {clientConfig.appId
                    ? `${clientConfig.appId.slice(0, 4)}••••`
                    : "Configured"}
                </span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Not set in env</span>
              </span>
            )}
          </div>
        </div>

        {/* Search-Only Key */}
        <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted block">
            Search API Key (Client)
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {status?.searchKeyConfigured || clientConfig.searchApiKey ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>
                  {clientConfig.searchApiKey
                    ? `${clientConfig.searchApiKey.slice(0, 4)}••••`
                    : "Configured"}
                </span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Not set in env</span>
              </span>
            )}
          </div>
        </div>

        {/* Admin API Key (Server) */}
        <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted block">
            Admin API Key (Server)
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {status?.adminKeyConfigured ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Configured (Server)</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Pending in env</span>
              </span>
            )}
          </div>
        </div>

        {/* Index Name & DB records */}
        <div className="p-3 rounded-lg bg-bg/50 border border-border space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted block">
            Target Index & Database
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-text font-semibold truncate">
            <Database className="w-3 h-3 text-accent shrink-0" />
            <span className="truncate">
              {status?.indexName || clientConfig.indexName}
            </span>
          </div>
          {status?.mediaRecordsInDatabase !== undefined && (
            <span className="text-[10px] text-text-muted block">
              {status.mediaRecordsInDatabase} titles in database
            </span>
          )}
        </div>
      </div>

      {/* Backfill Trigger Section */}
      <div className="p-4 rounded-xl border border-border/80 bg-surface-elevated/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-accent" />
              <span>Run Algolia Catalog Backfill</span>
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Bulk-indexes every existing row in the{" "}
              <code className="font-mono text-[11px] bg-bg px-1 py-0.5 rounded border border-border">
                media
              </code>{" "}
              table into Algolia, so titles synced before this change become instantly searchable.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isBackfilling}
            onClick={handleRunBackfill}
            className="shrink-0 gap-1.5 text-xs shadow-xs cursor-pointer"
          >
            {isBackfilling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Indexing Rows...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
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
            <div className="space-y-0.5 leading-relaxed">
              <strong className="block font-semibold">
                {backfillResult.success ? "Backfill Complete" : "Backfill Failed"}
              </strong>
              <span>
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
      <div className="p-3.5 rounded-lg bg-bg/60 border border-border/80 space-y-2 text-xs text-text-muted">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-text">
            <Terminal className="w-3.5 h-3.5 text-accent" />
            <span>CLI, API & Database Integration Details</span>
          </div>
          <a
            href="/api/admin/algolia/status"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent hover:underline flex items-center gap-1"
          >
            <span>Raw Status API</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <ul className="space-y-1 font-mono text-[11px] list-disc list-inside text-text-muted">
          <li>
            <strong className="text-text">CLI Command:</strong>{" "}
            <code className="bg-surface px-1 py-0.5 rounded border border-border">
              npm run algolia:backfill
            </code>
          </li>
          <li>
            <strong className="text-text">Admin API Route:</strong>{" "}
            <code className="bg-surface px-1 py-0.5 rounded border border-border">
              POST /api/admin/algolia/backfill
            </code>
          </li>
          <li>
            <strong className="text-text">Postgres Trigger:</strong>{" "}
            <code className="bg-surface px-1 py-0.5 rounded border border-border">
              AFTER INSERT OR UPDATE ON public.media
            </code>
          </li>
          <li>
            <strong className="text-text">Supabase Edge Function:</strong>{" "}
            <code className="bg-surface px-1 py-0.5 rounded border border-border">
              supabase/functions/algolia-sync
            </code>
          </li>
        </ul>
      </div>
    </div>
  );
}
