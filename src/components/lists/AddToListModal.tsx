"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  X,
  Plus,
  Check,
  Lock,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getStoredLists,
  addItemToList,
  removeItemFromList,
  createCustomList,
} from "@/lib/lists";
import { useAuth } from "@/context/AuthContext";
import type { ListWithItems, PrivacyLevel } from "@/types/database.types";

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    id: string;
    title: string;
    type: string;
    cover_url?: string | null;
    release_date?: string | null;
    genres?: string[];
    synopsis?: string | null;
    type_specific?: unknown;
    external_ids?: unknown;
    community_rating_avg?: number | null;
    community_rating_count?: number;
  };
  onSuccess?: (listId: string) => void;
}

export function AddToListModal({
  isOpen,
  onClose,
  media,
  onSuccess,
}: AddToListModalProps) {
  if (!isOpen) return null;

  return (
    <AddToListModalContent
      key={media.id}
      onClose={onClose}
      media={media}
      onSuccess={onSuccess}
    />
  );
}

function AddToListModalContent({
  onClose,
  media,
  onSuccess,
}: Omit<AddToListModalProps, "isOpen">) {
  const { user, profile } = useAuth();

  const [lists, setLists] = useState<ListWithItems[]>(() => getStoredLists());
  const [processingListId, setProcessingListId] = useState<string | null>(null);

  const [notesByList, setNotesByList] = useState<Record<string, string>>(() => {
    const all = getStoredLists();
    const initialNotes: Record<string, string> = {};
    all.forEach((l) => {
      const item = l.items?.find((it) => it.media_id === media.id);
      if (item?.notes) {
        initialNotes[l.id] = item.notes;
      }
    });
    return initialNotes;
  });

  const [expandedNotesListId, setExpandedNotesListId] = useState<string | null>(null);

  // Quick inline list creation state
  const [showCreateInline, setShowCreateInline] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListRanked, setNewListRanked] = useState(false);
  const [newListPrivacy, setNewListPrivacy] = useState<PrivacyLevel>("public");
  const [creatingInline, setCreatingInline] = useState(false);

  const mediaPayload = {
    id: media.id,
    title: media.title,
    type: media.type as "movie" | "tv" | "game" | "book",
    cover_url: media.cover_url || null,
    release_date: media.release_date || null,
    genres: media.genres || [],
    synopsis: media.synopsis || null,
    community_rating_avg: media.community_rating_avg || null,
    community_rating_count: media.community_rating_count || 0,
  };

  const handleToggle = async (list: ListWithItems) => {
    setProcessingListId(list.id);
    const isAlreadyInList = list.items?.some((it) => it.media_id === media.id);

    try {
      if (isAlreadyInList) {
        const updated = await removeItemFromList(list.id, media.id);
        if (updated) {
          setLists((prev) => prev.map((l) => (l.id === list.id ? updated : l)));
        }
      } else {
        const note = notesByList[list.id];
        const updated = await addItemToList(list.id, mediaPayload, note);
        if (updated) {
          setLists((prev) => prev.map((l) => (l.id === list.id ? updated : l)));
          if (onSuccess) onSuccess(list.id);
        }
      }
    } catch (e) {
      console.error("Failed to toggle list item:", e);
    } finally {
      setProcessingListId(null);
    }
  };

  const handleSaveNotes = async (listId: string) => {
    setProcessingListId(listId);
    try {
      const note = notesByList[listId] || "";
      const updated = await addItemToList(listId, mediaPayload, note);
      if (updated) {
        setLists((prev) => prev.map((l) => (l.id === listId ? updated : l)));
        setExpandedNotesListId(null);
      }
    } finally {
      setProcessingListId(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    setCreatingInline(true);
    try {
      const created = await createCustomList({
        name: newListName.trim(),
        is_ranked: newListRanked,
        privacy: newListPrivacy,
        userId: user?.id,
        userName: profile?.display_name || user?.user_metadata?.full_name || "You",
      });

      // Automatically add this media item to the newly created list
      const updated = await addItemToList(created.id, mediaPayload);
      if (updated) {
        setLists((prev) => [updated, ...prev]);
        if (onSuccess) onSuccess(created.id);
      }

      setNewListName("");
      setShowCreateInline(false);
    } catch (e) {
      console.error("Failed to create and add to list:", e);
    } finally {
      setCreatingInline(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "movie":
        return <Film className="w-3.5 h-3.5 text-amber-500" />;
      case "tv":
        return <Tv className="w-3.5 h-3.5 text-sky-500" />;
      case "game":
        return <Gamepad2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "book":
        return <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Film className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with media preview */}
        <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-15 rounded-md overflow-hidden bg-surface-elevated shrink-0 border border-border">
              {media.cover_url ? (
                <Image
                  src={media.cover_url}
                  alt={media.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">
                  {getMediaIcon(media.type)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-text-muted flex items-center gap-1">
                {getMediaIcon(media.type)}
                <span>Add to List</span>
              </span>
              <h2 className="font-serif text-sm font-bold text-text truncate">
                {media.title}
              </h2>
              {media.release_date && (
                <span className="text-[11px] text-text-muted">
                  {new Date(media.release_date).getFullYear()}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Quick Create Button / Form */}
          {!showCreateInline ? (
            <button
              type="button"
              onClick={() => setShowCreateInline(true)}
              className="w-full p-2.5 rounded-lg border border-dashed border-border hover:border-accent text-xs font-semibold text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New List & Add</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateAndAdd}
              className="p-3.5 rounded-lg border border-accent/40 bg-accent/5 space-y-3 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text">New Custom List</span>
                <button
                  type="button"
                  onClick={() => setShowCreateInline(false)}
                  className="text-text-muted hover:text-text text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <input
                type="text"
                required
                autoFocus
                placeholder="List name (e.g. 2026 Favorites)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden"
              />

              <div className="flex items-center justify-between text-xs gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newListRanked}
                    onChange={(e) => setNewListRanked(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] text-text-muted">Ranked list (#1, #2...)</span>
                </label>

                <select
                  value={newListPrivacy}
                  onChange={(e) => setNewListPrivacy(e.target.value as PrivacyLevel)}
                  className="px-2 py-1 text-[11px] rounded bg-bg border border-border text-text focus:outline-hidden"
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={creatingInline || !newListName.trim()}
                className="w-full text-xs h-7.5"
              >
                {creatingInline ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                <span>Create & Add Item</span>
              </Button>
            </form>
          )}

          {/* User's Lists */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted block px-1">
              Your Lists ({lists.length})
            </span>

            {lists.length === 0 ? (
              <div className="text-center py-6 text-xs text-text-muted border border-border/60 rounded-lg p-4">
                <p>You haven&apos;t created any lists yet.</p>
                <p className="mt-1 text-[11px]">
                  Click above to create your first ranked or unranked list!
                </p>
              </div>
            ) : (
              lists.map((list) => {
                const isInList = list.items?.some((it) => it.media_id === media.id);
                const isProcessing = processingListId === list.id;
                const isExpanded = expandedNotesListId === list.id;
                const currentRank = list.is_ranked
                  ? (list.items?.findIndex((it) => it.media_id === media.id) ?? -1) + 1
                  : null;

                return (
                  <div
                    key={list.id}
                    className={`rounded-lg border transition-all ${
                      isInList
                        ? "border-accent/40 bg-accent/5"
                        : "border-border bg-bg/50 hover:bg-surface-hover"
                    }`}
                  >
                    <div className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-serif text-xs font-bold text-text truncate">
                            {list.name}
                          </h3>
                          {list.is_ranked ? (
                            <Badge variant="amber" size="sm" className="text-[9px] py-0 px-1">
                              Ranked
                            </Badge>
                          ) : (
                            <Badge variant="subtle" size="sm" className="text-[9px] py-0 px-1">
                              Unranked
                            </Badge>
                          )}
                          {list.privacy === "private" && (
                            <Lock className="w-2.5 h-2.5 text-text-muted" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                          <span>{list.item_count || list.items?.length || 0} items</span>
                          {isInList && currentRank && currentRank > 0 && (
                            <span className="text-accent font-semibold">
                              · Ranked #{currentRank}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(list)}
                        disabled={isProcessing}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isInList
                            ? "bg-accent text-accent-contrast shadow-2xs hover:bg-accent/90"
                            : "bg-surface border border-border text-text hover:border-accent"
                        }`}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isInList ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>In List</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expandable rank note when in list */}
                    {isInList && (
                      <div className="px-3 pb-2.5 pt-0 border-t border-border/40 mt-1">
                        {!isExpanded ? (
                          <button
                            type="button"
                            onClick={() => setExpandedNotesListId(list.id)}
                            className="text-[11px] text-text-muted hover:text-accent underline font-sans cursor-pointer mt-1"
                          >
                            {notesByList[list.id] ? "Edit entry note..." : "+ Add note for this rank"}
                          </button>
                        ) : (
                          <div className="space-y-1.5 mt-2">
                            <textarea
                              rows={2}
                              value={notesByList[list.id] || ""}
                              onChange={(e) =>
                                setNotesByList((prev) => ({
                                  ...prev,
                                  [list.id]: e.target.value,
                                }))
                              }
                              placeholder="Why is it at this rank or on this list? (e.g. Best cinematography, favorite chapter...)"
                              className="w-full p-2 text-xs rounded bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent outline-hidden resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedNotesListId(null)}
                                className="text-[11px] text-text-muted hover:text-text cursor-pointer"
                              >
                                Cancel
                              </button>
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveNotes(list.id)}
                                disabled={isProcessing}
                                className="text-[11px] h-6 px-2"
                              >
                                Save Note
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface-elevated/20 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
