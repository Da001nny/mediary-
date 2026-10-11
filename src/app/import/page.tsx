"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  Film,
  BookOpen,
  Check,
  AlertCircle,
  Play,
  RotateCcw,
  Lock,
  Globe,
  Users,
  Sliders,
  Loader2,
  ArrowRight,
  FileCheck,
} from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import {
  parseLetterboxdFiles,
  parseGoodreadsFile,
  ImportSource,
  ImportVisibilityChoice,
  ImportPreviewSummary,
  ParsedImportItem,
} from "@/lib/import-parser";

interface ImportJob {
  id: string;
  source: string;
  status: "pending" | "processing" | "paused" | "completed" | "failed";
  options: { privacy?: string };
  total: number;
  matched: number;
  already_logged: number;
  needs_review: number;
  failed: number;
  created_at: string;
  updated_at: string;
}

interface NeedsReviewCandidate {
  tmdb_id?: number;
  google_books_id?: string;
  title: string;
  year?: string | number | null;
  author?: string | null;
  poster_url?: string | null;
  cover_url?: string | null;
  overview?: string | null;
  description?: string | null;
}

interface ImportItemRecord {
  id: string;
  job_id: string;
  row: ParsedImportItem;
  status: string;
  media_id: string | null;
  candidates: NeedsReviewCandidate[] | null;
  error: string | null;
  created_at: string;
}

export default function ImportPage() {
  const { profile } = useAuth();

  // Mode & source selection
  const [selectedSource, setSelectedSource] = useState<ImportSource>("letterboxd");
  const [selectedVisibility, setSelectedVisibility] =
    useState<ImportVisibilityChoice>("private");

  // File selection & parsing
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active / Ongoing Job
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [quotaPausedMessage, setQuotaPausedMessage] = useState<string | null>(null);

  // Items to review and failed items
  const [needsReviewItems, setNeedsReviewItems] = useState<ImportItemRecord[]>([]);
  const [failedItems, setFailedItems] = useState<ImportItemRecord[]>([]);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);

  // Cancellation
  const [isCancelling, setIsCancelling] = useState(false);

  // Check for active job on load
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/import/jobs");
        if (res.ok && !ignore) {
          const data = await res.json();
          if (data.activeJob) {
            setActiveJob(data.activeJob);
            if (data.activeJob.status === "paused") {
              setQuotaPausedMessage("Upstream rate quota reached. You can resume processing below.");
            }
          } else if (data.latestJob && data.latestJob.status === "completed") {
            setActiveJob(data.latestJob);
          }
        }
      } catch (err) {
        console.warn("Failed to check active import jobs:", err);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch needs-review and failed items whenever job is paused or completed
  useEffect(() => {
    if (!activeJob?.id || (activeJob.status !== "completed" && activeJob.status !== "paused")) {
      return;
    }
    let ignore = false;
    fetch(`/api/import/jobs/${activeJob.id}?status=needs_review`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data?.items) setNeedsReviewItems(data.items);
      })
      .catch((err) => console.warn(err));

    fetch(`/api/import/jobs/${activeJob.id}?status=failed`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data?.items) setFailedItems(data.items);
      })
      .catch((err) => console.warn(err));

    return () => {
      ignore = true;
    };
  }, [activeJob?.id, activeJob?.status]);

  const refreshReviewItems = useCallback(async (jobId: string) => {
    try {
      const [reviewRes, failedRes] = await Promise.all([
        fetch(`/api/import/jobs/${jobId}?status=needs_review`),
        fetch(`/api/import/jobs/${jobId}?status=failed`),
      ]);
      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setNeedsReviewItems(data.items || []);
      }
      if (failedRes.ok) {
        const data = await failedRes.json();
        setFailedItems(data.items || []);
      }
    } catch (err) {
      console.warn("Failed to refresh review items:", err);
    }
  }, []);

  // Handle file input changes
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParseError(null);
    setIsParsing(true);
    setPreview(null);

    try {
      const fileArray = Array.from(files);
      if (selectedSource === "letterboxd") {
        const result = await parseLetterboxdFiles(fileArray);
        setPreview(result);
      } else {
        const result = await parseGoodreadsFile(fileArray[0]);
        setPreview(result);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse files");
    } finally {
      setIsParsing(false);
    }
  };

  // Client-driven batch processor loop
  const runProcessingLoop = useCallback(async (jobId: string) => {
    setIsProcessing(true);
    setQuotaPausedMessage(null);

    let keepGoing = true;

    while (keepGoing) {
      try {
        const res = await fetch(`/api/import/jobs/${jobId}/process`, {
          method: "POST",
        });

        if (!res.ok) {
          throw new Error("Failed during batch process request");
        }

        const data = await res.json();
        if (data.job) {
          setActiveJob(data.job);
        }

        if (data.status === "completed" || data.remaining === 0) {
          keepGoing = false;
          setIsProcessing(false);
          await refreshReviewItems(jobId);
          break;
        }

        if (data.status === "paused" || data.reason === "quota_reached") {
          keepGoing = false;
          setIsProcessing(false);
          setQuotaPausedMessage(
            data.message || "Quota reached on upstream service. Please resume later."
          );
          await refreshReviewItems(jobId);
          break;
        }

        // Small pause between client calls to prevent UI freeze
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error("Batch processing error:", err);
        setIsProcessing(false);
        keepGoing = false;
        break;
      }
    }
  }, [refreshReviewItems]);

  // Start Import workflow: Create Job -> Upload batches of items -> trigger process loop
  const handleStartImport = async () => {
    if (!preview || preview.items.length === 0) return;

    setIsUploading(true);
    setParseError(null);

    try {
      // 1. Create Job
      const createRes = await fetch("/api/import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: preview.source,
          options: { privacy: selectedVisibility },
          total: preview.items.length,
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to create import job");
      }

      const { job } = await createRes.json();
      setActiveJob(job);

      // 2. Upload items in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < preview.items.length; i += CHUNK_SIZE) {
        const chunk = preview.items.slice(i, i + CHUNK_SIZE);
        const chunkRes = await fetch(`/api/import/jobs/${job.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk }),
        });

        if (!chunkRes.ok) {
          const chunkErr = await chunkRes.json().catch(() => ({}));
          throw new Error(chunkErr.error || "Failed to upload items batch");
        }
      }

      setIsUploading(false);
      setPreview(null);

      // 3. Start client-driven processing loop
      await runProcessingLoop(job.id);
    } catch (err) {
      setIsUploading(false);
      setParseError(err instanceof Error ? err.message : "Import setup failed");
    }
  };

  // Resume paused or in-progress job
  const handleResumeJob = async () => {
    if (!activeJob) return;
    await runProcessingLoop(activeJob.id);
  };

  // Cancel / delete current active job
  const handleCancelJob = async () => {
    if (!activeJob) return;
    if (!confirm("Are you sure you want to cancel this import job? Any unprocessed rows will be cleared.")) {
      return;
    }

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/import/jobs/${activeJob.id}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        setActiveJob(null);
        setNeedsReviewItems([]);
        setFailedItems([]);
        setQuotaPausedMessage(null);
      }
    } catch (err) {
      console.warn("Cancel job error:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Resolve a single needs_review item
  const handleResolveCandidate = async (
    itemId: string,
    action: "pick" | "skip",
    candidate?: NeedsReviewCandidate
  ) => {
    setResolvingItemId(itemId);
    try {
      const res = await fetch(`/api/import/items/${itemId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, candidate }),
      });

      if (res.ok) {
        // Remove item from needsReviewItems list
        setNeedsReviewItems((prev) => prev.filter((it) => it.id !== itemId));
        // Update active job counts locally
        if (activeJob) {
          setActiveJob({
            ...activeJob,
            needs_review: Math.max(0, activeJob.needs_review - 1),
            matched: action === "pick" ? activeJob.matched + 1 : activeJob.matched,
          });
        }
      }
    } catch (err) {
      console.error("Resolve item error:", err);
    } finally {
      setResolvingItemId(null);
    }
  };

  // Calculate progress percentage
  const totalItems = activeJob?.total || 1;
  const processedItems =
    (activeJob?.matched || 0) +
    (activeJob?.already_logged || 0) +
    (activeJob?.needs_review || 0) +
    (activeJob?.failed || 0);
  const progressPercent = Math.min(
    100,
    Math.round((processedItems / Math.max(1, totalItems)) * 100)
  );

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20 pb-20">
      <TopNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* Header Breadcrumb & Title */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Link href="/settings" className="hover:text-text transition-colors">
              Settings
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-text font-medium">Data Import</span>
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-text">
            Import from Letterboxd & Goodreads
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
            Bring your film and book history into your personal diary. Parse files locally in your browser, preview your library, and match against rich media metadata.
          </p>
        </div>

        {/* ACTIVE / RESUME JOB BANNER */}
        {activeJob && activeJob.status !== "completed" && (
          <div className="mb-8 p-4 sm:p-6 rounded-2xl bg-surface border border-accent/40 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base text-text capitalize">
                    {activeJob.source} Import in Progress
                  </span>
                  <span className="text-xs text-text-muted">·</span>
                  <span className="text-xs text-accent font-medium">
                    {activeJob.status === "paused" ? "Paused (Quota)" : "Active"}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Processed {processedItems} of {activeJob.total} items ({progressPercent}%)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelJob}
                  disabled={isCancelling || isProcessing}
                >
                  Cancel Job
                </Button>

                {!isProcessing && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleResumeJob}
                    leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                  >
                    Resume Processing
                  </Button>
                )}
              </div>
            </div>

            {/* Quota paused explanation banner */}
            {quotaPausedMessage && (
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-xs text-text flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Quota reached:</strong> {quotaPausedMessage} You can resume processing whenever your quota refreshes.
                </p>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-bg rounded-full overflow-hidden border border-border/60">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>{processedItems} claimed</span>
                <span>{Math.max(0, activeJob.total - processedItems)} remaining</span>
              </div>
            </div>

            {/* Live Counts Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-center">
              <div className="p-2 rounded-lg bg-bg/50">
                <div className="text-xs font-bold text-text">{activeJob.matched}</div>
                <div className="text-[10px] text-text-muted">Matched</div>
              </div>
              <div className="p-2 rounded-lg bg-bg/50">
                <div className="text-xs font-bold text-text">{activeJob.already_logged}</div>
                <div className="text-[10px] text-text-muted">Already Logged</div>
              </div>
              <div className="p-2 rounded-lg bg-bg/50">
                <div className="text-xs font-bold text-text">{activeJob.needs_review}</div>
                <div className="text-[10px] text-text-muted">Needs Review</div>
              </div>
              <div className="p-2 rounded-lg bg-bg/50">
                <div className="text-xs font-bold text-text">{activeJob.failed}</div>
                <div className="text-[10px] text-text-muted">Failed</div>
              </div>
            </div>
          </div>
        )}

        {/* SOURCE SELECTOR TABS (Shown when no active job is blocking) */}
        {(!activeJob || activeJob.status === "completed") && (
          <div className="space-y-6">
            {/* Source switcher buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-surface rounded-xl border border-border/80 w-fit">
              <button
                type="button"
                onClick={() => {
                  setSelectedSource("letterboxd");
                  setPreview(null);
                  setParseError(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedSource === "letterboxd"
                    ? "bg-surface-elevated text-text shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Film className="w-3.5 h-3.5 text-accent" />
                <span>Letterboxd</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedSource("goodreads");
                  setPreview(null);
                  setParseError(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedSource === "goodreads"
                    ? "bg-surface-elevated text-text shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-accent" />
                <span>Goodreads</span>
              </button>
            </div>

            {/* DROPZONE / FILE SELECTOR */}
            {!preview && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative p-8 sm:p-12 rounded-2xl border-2 border-dashed border-border/80 hover:border-accent/80 bg-surface/50 hover:bg-surface/80 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={selectedSource === "letterboxd"}
                  accept={
                    selectedSource === "letterboxd"
                      ? ".zip,.csv,application/zip,text/csv"
                      : ".csv,text/csv"
                  }
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text">
                    {selectedSource === "letterboxd"
                      ? "Choose Letterboxd Export ZIP or CSVs"
                      : "Choose goodreads_library_export.csv"}
                  </div>
                  <p className="text-xs text-text-muted max-w-sm">
                    {selectedSource === "letterboxd"
                      ? "Accepts your account export ZIP or individual files: ratings.csv, reviews.csv, diary.csv, watched.csv, watchlist.csv"
                      : "Export your library from Goodreads Settings → Account → Export Library (CSV)"}
                  </p>
                </div>

                <div className="text-[11px] text-text-muted pt-1">
                  Files up to 20 MB · Maximum 5,000 entries per import
                </div>

                {isParsing && (
                  <div className="flex items-center gap-2 text-xs text-accent mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Parsing export in browser...</span>
                  </div>
                )}
              </div>
            )}

            {/* PARSE ERROR MESSAGE */}
            {parseError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{parseError}</p>
              </div>
            )}

            {/* PREVIEW & VISIBILITY CONFIGURATION */}
            {preview && (
              <div className="p-5 sm:p-7 rounded-2xl bg-surface border border-border/80 card-depth space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-accent" />
                      <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
                        Ready to Import
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      {preview.breakdown}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-text-muted hover:text-text cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
                </div>

                {/* Entry Privacy Selection */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text">
                      Choose Visibility for Imported Entries
                    </label>
                    <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">
                      Select who will be able to see these entries once imported into your journal.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      {
                        id: "private",
                        label: "Private (Default)",
                        desc: "Visible only to you",
                        icon: Lock,
                      },
                      {
                        id: "friends",
                        label: "Friends",
                        desc: "Mutual follows only",
                        icon: Users,
                      },
                      {
                        id: "public",
                        label: "Public",
                        desc: "Visible to everyone",
                        icon: Globe,
                      },
                      {
                        id: "default",
                        label: "Use My Default",
                        desc: `Journal default (${profile?.default_privacy || "public"})`,
                        icon: Sliders,
                      },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedVisibility === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setSelectedVisibility(opt.id as ImportVisibilityChoice)
                          }
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                            isSelected
                              ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                              : "border-border/80 bg-bg/50 hover:bg-surface-hover text-text-muted"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon
                              className={`w-3.5 h-3.5 ${
                                isSelected ? "text-accent" : ""
                              }`}
                            />
                            <span className="text-xs font-bold text-text truncate">
                              {opt.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-muted leading-tight">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border/70">
                  <div className="text-[11px] text-text-muted">
                    No activity will be broadcast to followers during import. Existing entries are never overwritten.
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    isLoading={isUploading || isProcessing}
                    onClick={handleStartImport}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Start Import ({preview.total} items)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESULTS & REVIEW SECTION (When Job Completed or Paused) */}
        {activeJob && (activeJob.status === "completed" || activeJob.status === "paused") && (
          <div className="mt-10 space-y-8">
            {/* Job Summary Banner */}
            {activeJob.status === "completed" && (
              <div className="p-6 rounded-2xl bg-surface border border-border/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
                      Import Complete
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Successfully processed {activeJob.total} items from {activeJob.source}.
                    </p>
                  </div>

                  <Link href="/diary">
                    <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      View in Diary
                    </Button>
                  </Link>
                </div>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/70 text-center">
                  <div className="p-3 rounded-xl bg-surface-elevated border border-border/60">
                    <div className="text-base font-bold text-emerald-400">{activeJob.matched}</div>
                    <div className="text-xs text-text-muted">Imported</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-elevated border border-border/60">
                    <div className="text-base font-bold text-text-muted">{activeJob.already_logged}</div>
                    <div className="text-xs text-text-muted">Already Logged</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-elevated border border-border/60">
                    <div className="text-base font-bold text-amber-400">{activeJob.needs_review}</div>
                    <div className="text-xs text-text-muted">Needs Review</div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-elevated border border-border/60">
                    <div className="text-base font-bold text-red-400">{activeJob.failed}</div>
                    <div className="text-xs text-text-muted">Failed</div>
                  </div>
                </div>
              </div>
            )}

            {/* NEEDS REVIEW LIST */}
            {needsReviewItems.length > 0 && (
              <div className="p-5 sm:p-7 rounded-2xl bg-surface border border-amber-500/30 space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <h3 className="font-serif text-lg font-bold text-text">
                      Needs Review ({needsReviewItems.length})
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Multiple matching candidates or ambiguous release years were found. Pick the correct title or skip.
                  </p>
                </div>

                <div className="space-y-4">
                  {needsReviewItems.map((item) => {
                    const row = item.row;
                    const candidates = item.candidates || [];
                    const isResolving = resolvingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-surface-elevated border border-border/70 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                          <div>
                            <div className="text-sm font-bold text-text">
                              {row.title}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                              {row.year && <span>{row.year}</span>}
                              {row.author && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{row.author}</span>
                                </>
                              )}
                              {row.rating && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Rated {row.rating}/100</span>
                                </>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isResolving}
                            onClick={() => handleResolveCandidate(item.id, "skip")}
                          >
                            Skip Item
                          </Button>
                        </div>

                        {/* Candidates Grid */}
                        {candidates.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                            {candidates.map((cand, idx) => {
                              const poster = cand.poster_url || cand.cover_url;
                              return (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-lg bg-bg/80 border border-border/80 flex items-start gap-2.5 hover:border-accent transition-colors"
                                >
                                  {poster ? (
                                    <div className="relative w-12 h-16 rounded bg-surface shrink-0 overflow-hidden">
                                      <Image
                                        src={poster}
                                        alt={cand.title}
                                        fill
                                        sizes="48px"
                                        className="object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-16 rounded bg-surface-hover shrink-0 flex items-center justify-center text-text-muted text-[10px]">
                                      No Art
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                                    <div>
                                      <div className="text-xs font-semibold text-text truncate">
                                        {cand.title}
                                      </div>
                                      <div className="text-[10px] text-text-muted mt-0.5 truncate">
                                        {cand.year || cand.author || "Unknown"}
                                      </div>
                                    </div>

                                    <Button
                                      variant="primary"
                                      size="sm"
                                      disabled={isResolving}
                                      onClick={() =>
                                        handleResolveCandidate(item.id, "pick", cand)
                                      }
                                      className="mt-2 text-[10px] py-1 px-2.5 w-fit"
                                    >
                                      Select
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-text-muted italic">
                            No external matches found. You can skip this title and log it manually later.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FAILED LIST */}
            {failedItems.length > 0 && (
              <div className="p-5 sm:p-7 rounded-2xl bg-surface border border-red-500/20 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <h3 className="font-serif text-lg font-bold text-text">
                    Failed Items ({failedItems.length})
                  </h3>
                </div>

                <div className="divide-y divide-border/60">
                  {failedItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-text">
                          {item.row.title}
                        </span>
                        {item.row.year && (
                          <span className="text-text-muted ml-1.5">
                            ({item.row.year})
                          </span>
                        )}
                      </div>

                      <div className="text-red-400 text-[11px]">
                        {item.error || "Title could not be resolved"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
