"use client";

import React, { useState } from "react";
import {
  BookOpen,
  PenTool,
  Clock,
  ExternalLink,
  ChevronDown,
  Building,
  Globe,
  Check,
  Copy,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/database.types";

interface BookDetailsSectionProps {
  media: MediaItem;
}

export function BookDetailsSection({ media }: BookDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedIsbn, setCopiedIsbn] = useState(false);

  const typeSpecific = (media.type_specific as Record<string, unknown>) || {};
  const authors = (Array.isArray(typeSpecific.authors)
    ? typeSpecific.authors
    : typeSpecific.author
    ? [String(typeSpecific.author)]
    : []) as string[];
  const primaryAuthor = authors[0] || String(typeSpecific.author || "Unknown Author");
  const pageCount =
    typeof typeSpecific.page_count === "number" && typeSpecific.page_count > 0
      ? typeSpecific.page_count
      : null;
  const isbn =
    typeof typeSpecific.isbn === "string"
      ? typeSpecific.isbn
      : typeof typeSpecific.isbn_13 === "string"
      ? typeSpecific.isbn_13
      : null;
  const isbn10 = typeof typeSpecific.isbn_10 === "string" ? typeSpecific.isbn_10 : null;
  const edition =
    typeof typeSpecific.edition === "string" ? typeSpecific.edition : null;
  const series =
    typeof typeSpecific.series === "string" ? typeSpecific.series : null;
  const publisher =
    typeof typeSpecific.publisher === "string" ? typeSpecific.publisher : null;
  const publishedDate =
    typeof typeSpecific.published_date === "string"
      ? typeSpecific.published_date
      : media.release_date;
  const language =
    typeof typeSpecific.language === "string" ? typeSpecific.language.toUpperCase() : "EN";
  const previewLink =
    typeof typeSpecific.preview_link === "string"
      ? typeSpecific.preview_link
      : typeof typeSpecific.info_link === "string"
      ? typeSpecific.info_link
      : null;

  // Approximate reading time (~50 pages per hour for average adult reading)
  const estimatedHours = pageCount ? Math.round((pageCount / 50) * 10) / 10 : null;

  const handleCopyIsbn = () => {
    if (!isbn) return;
    navigator.clipboard.writeText(isbn);
    setCopiedIsbn(true);
    setTimeout(() => setCopiedIsbn(false), 2000);
  };

  return (
    <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs transition-colors">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
                Book Details & Edition
              </h2>
              <Badge variant="subtle" size="sm">
                Book
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Author credits, page length, ISBN, and publication metadata
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {previewLink && (
            <a
              href={previewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent font-medium px-2.5 py-1.5 rounded-md hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              <span>Google Books Preview</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs gap-1.5 text-text-muted hover:text-text cursor-pointer"
          >
            <span>{isExpanded ? "Collapse" : "Expand"}</span>
            <ChevronDown
              className={cn("w-4 h-4 transition-transform duration-200", {
                "rotate-180": isExpanded,
              })}
            />
          </Button>
        </div>
      </div>

      {/* Main Content Body */}
      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Key Specs Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Author */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-accent" />
                <span>Primary Author</span>
              </span>
              <div className="mt-2">
                <span className="text-xs font-semibold text-text truncate block">
                  {primaryAuthor}
                </span>
              </div>
            </div>

            {/* Page Count */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-accent" />
                <span>Page Count</span>
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-text">
                  {pageCount ? pageCount.toLocaleString() : "Unknown"}
                </span>
                {pageCount && <span className="text-xs text-text-muted">pages</span>}
              </div>
            </div>

            {/* Estimated Read Time */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>Est. Read Time</span>
              </span>
              <div className="mt-2">
                <span className="text-xs font-semibold text-text">
                  {estimatedHours ? `~${estimatedHours} Hours` : "Varied pace"}
                </span>
              </div>
            </div>

            {/* Language / Format */}
            <div className="p-3.5 rounded-lg bg-bg border border-border flex flex-col justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-accent" />
                <span>Language & Format</span>
              </span>
              <div className="mt-2">
                <span className="text-xs font-semibold text-text">
                  {language} · Print Book
                </span>
              </div>
            </div>
          </div>

          {/* Edition, Series & Publishing Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Author & Series Information */}
            <div className="p-4 rounded-lg bg-bg border border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <PenTool className="w-4 h-4 text-accent" />
                <span>Author & Series Details</span>
              </h3>

              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-[11px] text-text-muted block mb-1 font-medium">
                    Authors ({authors.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {authors.map((auth) => (
                      <Badge key={auth} variant="subtle" size="md">
                        {auth}
                      </Badge>
                    ))}
                  </div>
                </div>

                {series && (
                  <div>
                    <span className="text-[11px] text-text-muted block mb-1 font-medium">
                      Series / Subtitle
                    </span>
                    <span className="text-xs font-medium text-text bg-surface px-2.5 py-1 rounded border border-border inline-block">
                      {series}
                    </span>
                  </div>
                )}

                {media.genres && media.genres.length > 0 && (
                  <div>
                    <span className="text-[11px] text-text-muted block mb-1 font-medium">
                      Categories & Subjects
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {media.genres.map((genre) => (
                        <span
                          key={genre}
                          className="text-[11px] px-2 py-0.5 rounded bg-surface border border-border text-text-muted font-medium"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Publishing & ISBN Card */}
            <div className="p-4 rounded-lg bg-bg border border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <Building className="w-4 h-4 text-accent" />
                <span>Publication & ISBN</span>
              </h3>

              <div className="space-y-3 pt-1">
                {publisher && (
                  <div>
                    <span className="text-[11px] text-text-muted block mb-0.5 font-medium">
                      Publisher
                    </span>
                    <span className="text-xs font-semibold text-text">
                      {publisher}
                    </span>
                  </div>
                )}

                {publishedDate && (
                  <div>
                    <span className="text-[11px] text-text-muted block mb-0.5 font-medium">
                      Publication Date
                    </span>
                    <span className="text-xs text-text font-mono">
                      {publishedDate}
                    </span>
                  </div>
                )}

                {edition && (
                  <div>
                    <span className="text-[11px] text-text-muted block mb-0.5 font-medium">
                      Edition Info
                    </span>
                    <span className="text-xs text-text">
                      {edition}
                    </span>
                  </div>
                )}

                {/* ISBN section with quick copy */}
                {(isbn || isbn10) && (
                  <div className="pt-1">
                    <span className="text-[11px] text-text-muted block mb-1.5 font-medium">
                      Standard Identifiers (ISBN)
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {isbn && (
                        <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded border border-border text-xs font-mono">
                          <span className="text-text-muted text-[10px]">ISBN-13:</span>
                          <span className="font-semibold text-text">{isbn}</span>
                          <button
                            type="button"
                            onClick={handleCopyIsbn}
                            title="Copy ISBN"
                            className="ml-1 text-text-muted hover:text-accent cursor-pointer"
                          >
                            {copiedIsbn ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}

                      {isbn10 && (
                        <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded border border-border text-xs font-mono">
                          <span className="text-text-muted text-[10px]">ISBN-10:</span>
                          <span className="text-text">{isbn10}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
