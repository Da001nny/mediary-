"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Reorder } from "motion/react";
import {
  GripVertical,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  ChevronUp,
  ChevronDown,
  Trash2,
  Star,
  Edit2,
  Check,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { CustomListItem, MediaItem } from "@/types/database.types";

interface ListItemWithMedia extends CustomListItem {
  media?: MediaItem | null;
}

interface ReorderableItemListProps {
  items: ListItemWithMedia[];
  isRanked: boolean;
  isOwner: boolean;
  onReorder: (newItems: ListItemWithMedia[]) => void;
  onRemoveItem: (mediaId: string) => void;
  onUpdateNotes: (itemId: string, notes: string) => void;
}

export function ReorderableItemList({
  items,
  isRanked,
  isOwner,
  onReorder,
  onRemoveItem,
  onUpdateNotes,
}: ReorderableItemListProps) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const handleDragReorder = (newItems: ListItemWithMedia[]) => {
    // Re-assign 1-based positions
    const updated = newItems.map((it, idx) => ({
      ...it,
      position: idx + 1,
    }));
    onReorder(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index - 1, 0, moved);
    handleDragReorder(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + 1, 0, moved);
    handleDragReorder(reordered);
  };

  const startEditNote = (item: ListItemWithMedia) => {
    setEditingNoteId(item.id);
    setNoteDraft(item.notes || "");
  };

  const saveNote = (itemId: string) => {
    onUpdateNotes(itemId, noteDraft);
    setEditingNoteId(null);
  };

  const getMediaBadge = (type?: string) => {
    switch (type) {
      case "movie":
        return (
          <Badge variant="amber" size="sm" className="gap-1 text-[10px]">
            <Film className="w-2.5 h-2.5" />
            <span>Movie</span>
          </Badge>
        );
      case "tv":
        return (
          <Badge variant="subtle" size="sm" className="gap-1 text-[10px]">
            <Tv className="w-2.5 h-2.5" />
            <span>TV</span>
          </Badge>
        );
      case "game":
        return (
          <Badge variant="forest" size="sm" className="gap-1 text-[10px]">
            <Gamepad2 className="w-2.5 h-2.5" />
            <span>Game</span>
          </Badge>
        );
      case "book":
        return (
          <Badge variant="caramel" size="sm" className="gap-1 text-[10px]">
            <BookOpen className="w-2.5 h-2.5" />
            <span>Book</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="subtle" size="sm">
            {type}
          </Badge>
        );
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-border rounded-xl bg-surface/30 p-8 space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-surface border border-border flex items-center justify-center text-text-muted">
          <BookOpen className="w-6 h-6 opacity-60" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif text-lg font-bold text-text">No items in this list yet</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {isOwner
              ? "Use the 'Add Media' button above to search and add movies, TV shows, games, or books to this list."
              : "This list is currently empty."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isOwner && isRanked && (
        <div className="flex items-center justify-between text-xs text-text-muted px-1 pb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <GripVertical className="w-3.5 h-3.5 text-accent" />
            <span>Drag items to reorder ranks, or use the arrow buttons</span>
          </span>
          <span className="text-[11px] font-mono opacity-75">{items.length} ranked items</span>
        </div>
      )}

      {/* Motion Reorder Group for smooth drag and drop */}
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={isOwner ? handleDragReorder : () => {}}
        className="space-y-3"
      >
        {items.map((item, index) => {
          const media = item.media;
          const displayRank = index + 1;
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const isEditing = editingNoteId === item.id;

          return (
            <Reorder.Item
              key={item.id}
              value={item}
              dragListener={isOwner}
              className="touch-none select-none"
            >
              <div className="group relative rounded-xl border border-border bg-surface hover:border-text/30 transition-all shadow-xs overflow-hidden">
                <div className="p-3.5 sm:p-4 flex items-start gap-3 sm:gap-4">
                  {/* Drag Handle & Position Indicator */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-center">
                    {isOwner && (
                      <div
                        className="cursor-grab active:cursor-grabbing p-1.5 text-text-muted/60 hover:text-text rounded hover:bg-surface-hover transition-colors"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}

                    {/* Rank Badge if Ranked list */}
                    {isRanked ? (
                      <div className="flex flex-col items-center justify-center min-w-[2.25rem]">
                        <span
                          className={`font-serif text-lg sm:text-xl font-black leading-none ${
                            displayRank === 1
                              ? "text-amber-500"
                              : displayRank === 2
                              ? "text-slate-400"
                              : displayRank === 3
                              ? "text-amber-700 dark:text-amber-600"
                              : "text-text-muted"
                          }`}
                        >
                          #{displayRank}
                        </span>
                      </div>
                    ) : (
                      <div className="w-2" />
                    )}
                  </div>

                  {/* Media Cover Poster */}
                  <Link
                    href={`/media/${encodeURIComponent(item.media_id)}`}
                    className="relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden bg-surface-elevated shrink-0 border border-border shadow-xs hover:opacity-90 transition-opacity"
                  >
                    {media?.cover_url ? (
                      <Image
                        src={media.cover_url}
                        alt={media?.title || "Media cover"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 56px, 64px"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <BookOpen className="w-6 h-6 opacity-40" />
                      </div>
                    )}
                  </Link>

                  {/* Main Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getMediaBadge(media?.type)}
                      {media?.release_date && (
                        <span className="text-xs text-text-muted font-sans">
                          {new Date(media.release_date).getFullYear()}
                        </span>
                      )}
                      {media?.community_rating_avg !== null &&
                        media?.community_rating_avg !== undefined && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-text">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{Number(media.community_rating_avg).toFixed(1)}</span>
                          </div>
                        )}
                    </div>

                    <h4 className="font-serif text-base sm:text-lg font-bold text-text leading-snug group-hover:text-accent transition-colors">
                      <Link
                        href={`/media/${encodeURIComponent(item.media_id)}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        <span>{media?.title || "Untitled Media"}</span>
                        <ExternalLink className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    </h4>

                    {/* Genres */}
                    {Array.isArray(media?.genres) && media.genres.length > 0 && (
                      <p className="text-[11px] text-text-muted truncate">
                        {media.genres.slice(0, 3).join(" · ")}
                      </p>
                    )}

                    {/* Note section */}
                    <div className="pt-1.5">
                      {isEditing ? (
                        <div className="space-y-1.5 mt-1 animate-in fade-in duration-150">
                          <textarea
                            rows={2}
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Why is it on this list? Add your thoughts..."
                            className="w-full p-2 text-xs rounded bg-bg border border-accent text-text focus:outline-hidden"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveNote(item.id)}
                              className="px-3 py-1 bg-accent text-[#0E0902] dark:text-[#0A0702] rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-accent-hover transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover/60 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : item.notes ? (
                        <div className="p-2 rounded-md bg-surface-elevated/60 border border-border/60 text-xs text-text/90 italic font-serif flex items-start justify-between gap-2">
                          <p className="leading-relaxed">&ldquo;{item.notes}&rdquo;</p>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => startEditNote(item)}
                              className="text-text-muted hover:text-accent p-0.5 shrink-0 cursor-pointer"
                              title="Edit note"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : isOwner ? (
                        <button
                          type="button"
                          onClick={() => startEditNote(item)}
                          className="text-[11px] text-text-muted hover:text-accent font-sans transition-colors cursor-pointer"
                        >
                          + Add note about this rank
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Owner Controls (Nudge up/down & Delete) */}
                  {isOwner && (
                    <div className="flex flex-col items-center gap-1 shrink-0 self-center pl-1 sm:pl-2 border-l border-border/50">
                      {isRanked && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={isFirst}
                            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move up in rank"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={isLast}
                            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move down in rank"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.media_id)}
                        className="p-1.5 rounded text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer mt-1"
                        title="Remove from list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
}
