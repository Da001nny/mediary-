"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ListOrdered,
  ListFilter,
  Globe,
  Users,
  Lock,
  Plus,
  Edit3,
  Trash2,
  Share2,
  Check,
  ArrowLeft,
  Calendar,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ReorderableItemList } from "./ReorderableItemList";
import { CreateListModal } from "./CreateListModal";
import { MediaSearchModal } from "@/components/media/MediaSearchModal";
import { LikeButton } from "@/components/social/LikeButton";
import { CommentSection } from "@/components/social/CommentSection";
import {
  getListById,
  deleteCustomList,
  removeItemFromList,
  addItemToList,
  reorderListItems,
} from "@/lib/lists";
import { useAuth } from "@/context/AuthContext";
import type { ListWithItems, CustomListItem, MediaItem } from "@/types/database.types";

interface ListItemWithMedia extends CustomListItem {
  media?: MediaItem | null;
}

interface ListDetailViewProps {
  initialList: ListWithItems;
}

export function ListDetailView({ initialList }: ListDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [list, setList] = useState<ListWithItems>(initialList);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  // isOwner must be true ONLY when list.user_id equals the signed-in user's id
  const isOwner = Boolean(user && list.user_id === user.id);

  // Refresh list data from server
  useEffect(() => {
    async function load() {
      const res = await getListById(initialList.id);
      if (res.list) {
        setList(res.list);
      }
    }
    load();
  }, [initialList.id]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteCustomList(list.id);
      router.push("/lists");
    } catch (e) {
      console.error("Failed to delete list:", e);
      setIsDeleting(false);
      setIsConfirmingDelete(false);
      setActionError(e instanceof Error ? e.message : "Failed to delete list. Please try again.");
    }
  };

  const handleReorder = async (reorderedItems: ListItemWithMedia[]) => {
    const previousList = list;
    setActionError(null);
    // Optimistic update in component state only
    setList((prev) => ({
      ...prev,
      items: reorderedItems,
    }));

    try {
      await reorderListItems(
        list.id,
        reorderedItems.map((it) => it.id)
      );
    } catch (err) {
      // Roll back on failure
      setList(previousList);
      setActionError(err instanceof Error ? err.message : "Failed to reorder list items. Changes rolled back.");
    }
  };

  const handleRemoveItem = async (mediaId: string) => {
    const previousList = list;
    setActionError(null);
    const currentItems = list.items || [];
    const remainingItems = currentItems
      .filter((it) => it.media_id !== mediaId)
      .map((it, idx) => ({ ...it, position: idx + 1 }));
    const previewCovers = remainingItems
      .map((it) => it.media?.cover_url)
      .filter((c): c is string => Boolean(c))
      .slice(0, 4);

    // Optimistic update in component state only
    setList((prev) => ({
      ...prev,
      items: remainingItems,
      item_count: remainingItems.length,
      preview_covers: previewCovers,
    }));

    try {
      await removeItemFromList(list.id, mediaId);
    } catch (err) {
      // Roll back on failure
      setList(previousList);
      setActionError(err instanceof Error ? err.message : "Failed to remove item from list. Changes rolled back.");
    }
  };

  const handleUpdateNotes = async (itemId: string, notes: string) => {
    const previousList = list;
    setActionError(null);
    const targetItem = list.items?.find((it) => it.id === itemId);
    if (!targetItem) return;

    // Optimistic update in component state only
    setList((prev) => ({
      ...prev,
      items: (prev.items || []).map((it) =>
        it.id === itemId ? { ...it, notes } : it
      ),
    }));

    try {
      await addItemToList(
        list.id,
        targetItem.media || {
          id: targetItem.media_id,
          title: "Media",
          type: "movie",
        },
        notes
      );
    } catch (err) {
      // Roll back on failure
      setList(previousList);
      setActionError(err instanceof Error ? err.message : "Failed to update item notes. Changes rolled back.");
    }
  };

  // Filter items by media type
  const items = list.items || [];
  const filteredItems = items.filter((it) => {
    if (typeFilter === "all") return true;
    return it.media?.type === typeFilter;
  });

  const getPrivacyBadge = () => {
    switch (list.privacy) {
      case "public":
        return (
          <Badge variant="subtle" size="sm" className="gap-1 text-[11px]">
            <Globe className="w-3 h-3 text-emerald-500" />
            <span>Public List</span>
          </Badge>
        );
      case "friends":
        return (
          <Badge variant="subtle" size="sm" className="gap-1 text-[11px]">
            <Users className="w-3 h-3 text-sky-500" />
            <span>Friends Only</span>
          </Badge>
        );
      case "private":
        return (
          <Badge variant="subtle" size="sm" className="gap-1 text-[11px]">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Private</span>
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/lists"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-medium transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to All Lists</span>
        </Link>
      </div>

      {/* Action Error Notification */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 cursor-pointer font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* List Header Hero Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {list.is_ranked ? (
                <Badge variant="amber" size="md" className="gap-1.5 font-bold">
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Ranked List</span>
                </Badge>
              ) : (
                <Badge variant="subtle" size="md" className="gap-1.5 font-semibold">
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Unranked Collection</span>
                </Badge>
              )}
              {getPrivacyBadge()}
              <span className="text-xs text-text-muted">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </div>

            {/* List Title */}
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-text tracking-tight leading-tight">
              {list.name}
            </h1>

            {/* Description */}
            {list.description && (
              <p className="font-serif text-sm sm:text-base text-text-muted/95 leading-relaxed max-w-2xl">
                {list.description}
              </p>
            )}

            {/* Owner & Date Info */}
            <div className="flex items-center gap-3 pt-2 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent text-accent-contrast font-serif font-bold text-[10px] flex items-center justify-center">
                  {list.owner?.display_name?.charAt(0).toUpperCase() || "M"}
                </div>
                <span className="font-medium text-text">
                  {list.owner?.display_name || "Curator"}
                </span>
              </div>
              <span aria-hidden="true" className="text-border">·</span>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-text-muted" />
                <span>
                  Updated{" "}
                  {new Date(list.updated_at || list.created_at).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap md:flex-col items-stretch gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <LikeButton listId={list.id} size="md" />
            </div>

            {isOwner && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSearchModalOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Media
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              leftIcon={
                isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )
              }
            >
              {isCopied ? "Link Copied" : "Share List"}
            </Button>

            {isOwner && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  leftIcon={<Edit3 className="w-3.5 h-3.5 text-accent" />}
                >
                  Edit Details
                </Button>

                {isConfirmingDelete ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                    >
                      Confirm Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                      className="text-text-muted hover:text-text cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={isDeleting}
                    leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                  >
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filter Bar within List */}
        {items.length > 0 && (
          <div className="pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mr-1">
                Filter:
              </span>
              {[
                { id: "all", label: "All" },
                { id: "movie", label: "Movies", icon: Film },
                { id: "tv", label: "TV", icon: Tv },
                { id: "game", label: "Games", icon: Gamepad2 },
                { id: "book", label: "Books", icon: BookOpen },
              ].map((tab) => {
                const Icon = tab.icon;
                const count =
                  tab.id === "all"
                    ? items.length
                    : items.filter((it) => it.media?.type === tab.id).length;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      typeFilter === tab.id
                        ? "bg-accent text-accent-contrast shadow-2xs"
                        : "bg-surface-elevated/70 text-text-muted hover:text-text hover:bg-surface-elevated"
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>

            {list.is_ranked && (
              <span className="text-xs text-text-muted font-serif italic">
                Items ordered #1 through #{items.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Reorderable Item List */}
      <ReorderableItemList
        items={filteredItems}
        isRanked={list.is_ranked}
        isOwner={isOwner}
        onReorder={handleReorder}
        onRemoveItem={handleRemoveItem}
        onUpdateNotes={handleUpdateNotes}
      />

      {/* Social Discussion / Comments for List */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
        <h2 className="font-serif text-lg sm:text-xl font-bold text-text">
          List Discussion & Comments
        </h2>
        <CommentSection listId={list.id} initialIsOpen={true} />
      </div>

      {/* Edit List Modal */}
      <CreateListModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        listToEdit={list}
        onSaved={(updated) => setList(updated)}
      />

      {/* Media Search Modal for Adding Items directly to this List */}
      <MediaSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
}
