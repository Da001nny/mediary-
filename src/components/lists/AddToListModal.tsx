"use client";

import React, { useState, useEffect } from "react";
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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getLists,
  addItemToList,
  removeItemFromList,
  createCustomList,
} from "@/lib/lists";
import { useAuth } from "@/context/AuthContext";
import type { ListWithItems, PrivacyLevel, MediaItem, Json } from "@/types/database.types";

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

  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingListId, setProcessingListId] = useState<string | null>(null);

  const [notesByList, setNotesByList] = useState<Record<string, string>>({});
  const [expandedNotesListId, setExpandedNotesListId] = useState<string | null>(null);

  // Quick inline list creation state
  const [showCreateInline, setShowCreateInline] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListRanked, setNewListRanked] = useState(false);
  const [newListPrivacy, setNewListPrivacy] = useState<PrivacyLevel>(
    profile?.default_privacy || "private"
  );
  const [creatingInline, setCreatingInline] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getLists(user?.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setErrorMessage(res.error);
          setLists([]);
        } else {
          setLists(res.lists);
          // Initialize existing notes
          const initialNotes: Record<string, string> = {};
          res.lists.forEach((l) => {
            const item = l.items?.find((it) => it.media_id === media.id);
            if (item?.notes) {
              initialNotes[l.id] = item.notes;
            }
          });
          setNotesByList(initialNotes);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMessage("Couldn't load lists");
        setLists([]);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id, media.id]);

  const mediaPayload: MediaItem = {
    id: media.id,
    title: media.title,
    type: media.type as "movie" | "tv" | "game" | "book",
    cover_url: media.cover_url || null,
    release_date: media.release_date || null,
    genres: media.genres || [],
    synopsis: media.synopsis || null,
    community_rating_avg: media.community_rating_avg || null,
    community_rating_count: media.community_rating_count || 0,
    type_specific: (media.type_specific as Json) || {},
    external_ids: (media.external_ids as Json) || {},
    watch_providers: {},
    localized_fields: {},
    last_synced_at: new Date().toISOString(),
  };

  const handleToggle = async (list: ListWithItems) => {
    setProcessingListId(list.id);
    setErrorMessage(null);
    const previousLists = lists;
    const isAlreadyInList = list.items?.some((it) => it.media_id === media.id);

    // Optimistic component state update
    if (isAlreadyInList) {
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== list.id) return l;
          const items = (l.items || []).filter((it) => it.media_id !== media.id);
          return { ...l, items, item_count: items.length };
        })
      );
    } else {
      const tempId = `temp-${media.id}-${list.id}`;
      const nowIso = new Date().toISOString();
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== list.id) return l;
          const items = [
            ...(l.items || []),
            {
              id: tempId,
              list_id: l.id,
              media_id: media.id,
              position: (l.items?.length || 0) + 1,
              notes: notesByList[l.id] || null,
              added_at: nowIso,
              media: mediaPayload,
            },
          ];
          return { ...l, items, item_count: items.length };
        })
      );
    }

    try {
      if (isAlreadyInList) {
        await removeItemFromList(list.id, media.id);
      } else {
        const note = notesByList[list.id];
        await addItemToList(list.id, mediaPayload, note);
        if (onSuccess) onSuccess(list.id);
      }
    } catch (e) {
      // Roll back optimistic state on error
      setLists(previousLists);
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to update list. Changes rolled back."
      );
    } finally {
      setProcessingListId(null);
    }
  };

  const handleSaveNotes = async (listId: string) => {
    setProcessingListId(listId);
    setErrorMessage(null);
    const previousLists = lists;
    const note = notesByList[listId] || "";

    // Optimistically update note in component state
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          items: (l.items || []).map((it) =>
            it.media_id === media.id ? { ...it, notes: note } : it
          ),
        };
      })
    );

    try {
      await addItemToList(listId, mediaPayload, note);
      setExpandedNotesListId(null);
    } catch (e) {
      setLists(previousLists);
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to save note. Changes rolled back."
      );
    } finally {
      setProcessingListId(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    setCreatingInline(true);
    setErrorMessage(null);
    try {
      const created = await createCustomList({
        name: newListName.trim(),
        is_ranked: newListRanked,
        privacy: newListPrivacy,
        userId: user?.id,
        userName: profile?.display_name || user?.user_metadata?.full_name || "You",
      });

      // Add media item to the newly created database list
      await addItemToList(created.id, mediaPayload);
      const newItemId = `item-${created.id}-${media.id}`;
      const updatedCreated: ListWithItems = {
        ...created,
        items: [
          {
            id: newItemId,
            list_id: created.id,
            media_id: media.id,
            position: 1,
            notes: null,
            added_at: created.created_at || new Date().toISOString(),
            media: mediaPayload,
          },
        ],
        item_count: 1,
        preview_covers: media.cover_url ? [media.cover_url] : [],
      };

      setLists((prev) => [updatedCreated, ...prev]);
      if (onSuccess) onSuccess(created.id);
      setNewListName("");
      setShowCreateInline(false);
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to create and add to list."
      );
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

        {/* Error notification banner if any action failed */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

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
                  <option value="private">Private</option>
                  <option value="friends">Friends</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={creatingInline}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                disabled={!newListName.trim()}
                className="w-full justify-center"
              >
                Create & Add Item
              </Button>
            </form>
          )}

          {/* User's Lists */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted block px-1">
              Your Lists ({lists.length})
            </span>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <span className="text-xs">Loading lists...</span>
              </div>
            ) : lists.length === 0 ? (
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
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isInList
                            ? "bg-accent text-[#0E0902] dark:text-[#0A0702] shadow-2xs hover:bg-accent-hover"
                            : "bg-surface border border-border text-text hover:border-accent hover:bg-surface-hover"
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
                                className="h-7.5 px-3 text-xs"
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
