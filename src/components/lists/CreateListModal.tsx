"use client";

import React, { useState } from "react";
import {
  X,
  ListOrdered,
  ListFilter,
  Globe,
  Users,
  Lock,
  FolderPlus,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createCustomList, updateCustomList } from "@/lib/lists";
import { useAuth } from "@/context/AuthContext";
import type { CustomList, ListWithItems, PrivacyLevel } from "@/types/database.types";

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (list: ListWithItems) => void;
  listToEdit?: CustomList | null;
}

export function CreateListModal({
  isOpen,
  onClose,
  onSaved,
  listToEdit,
}: CreateListModalProps) {
  if (!isOpen) return null;

  return (
    <CreateListModalContent
      key={listToEdit?.id || "new-list"}
      onClose={onClose}
      onSaved={onSaved}
      listToEdit={listToEdit}
    />
  );
}

function CreateListModalContent({
  onClose,
  onSaved,
  listToEdit,
}: Omit<CreateListModalProps, "isOpen">) {
  const { user, profile } = useAuth();
  const [name, setName] = useState(listToEdit?.name || "");
  const [description, setDescription] = useState(listToEdit?.description || "");
  const [isRanked, setIsRanked] = useState(Boolean(listToEdit?.is_ranked));
  const [privacy, setPrivacy] = useState<PrivacyLevel>(
    listToEdit?.privacy || profile?.default_privacy || "private"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for your list.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (listToEdit) {
        const updated = await updateCustomList(listToEdit.id, {
          name: name.trim(),
          description: description.trim() || null,
          is_ranked: isRanked,
          privacy,
        });
        if (updated && onSaved) {
          onSaved(updated);
        }
      } else {
        const created = await createCustomList({
          name: name.trim(),
          description: description.trim() || undefined,
          is_ranked: isRanked,
          privacy,
          userId: user?.id,
          userName: profile?.display_name || user?.user_metadata?.full_name || "You",
        });
        if (created && onSaved) {
          onSaved(created);
        }
      }
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save list. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
              {listToEdit ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-text">
                {listToEdit ? "Edit Custom List" : "Create a Custom List"}
              </h2>
              <p className="text-xs text-text-muted">
                Curate, rank, and organize your favorite media.
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
              {error}
            </div>
          )}

          {/* List Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="list-name"
              className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              List Title <span className="text-accent">*</span>
            </label>
            <input
              id="list-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Top 10 Sci-Fi Films of the 21st Century"
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="list-description"
              className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              Description <span className="text-text-muted/60 lowercase font-normal">(optional)</span>
            </label>
            <textarea
              id="list-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give your list some context, guidelines, or an introduction..."
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-bg border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden transition-colors resize-none"
            />
          </div>

          {/* Ranking Mode (Ranked vs Unranked) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              List Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsRanked(false)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  !isRanked
                    ? "border-accent bg-accent/10 text-text"
                    : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListFilter
                    className={`w-4 h-4 ${!isRanked ? "text-accent" : "text-text-muted"}`}
                  />
                  <span className="text-xs font-bold text-text">Unranked</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-85">
                  A flexible collection or moodboard of media without numerical ordering.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsRanked(true)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isRanked
                    ? "border-accent bg-accent/10 text-text"
                    : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListOrdered
                    className={`w-4 h-4 ${isRanked ? "text-accent" : "text-text-muted"}`}
                  />
                  <span className="text-xs font-bold text-text">Ranked</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-85">
                  Numbered items (#1, #2, #3...) with drag-to-reorder priority.
                </p>
              </button>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Privacy Setting
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPrivacy("private")}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  privacy === "private"
                    ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                    : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Lock className={`w-3.5 h-3.5 ${privacy === "private" ? "text-accent" : ""}`} />
                  <span className="text-xs font-semibold">Private</span>
                </div>
                <span className="text-[10px] opacity-75">Only you</span>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy("friends")}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  privacy === "friends"
                    ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                    : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Users className={`w-3.5 h-3.5 ${privacy === "friends" ? "text-accent" : ""}`} />
                  <span className="text-xs font-semibold">Friends</span>
                </div>
                <span className="text-[10px] opacity-75">Friends only</span>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy("public")}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  privacy === "public"
                    ? "border-accent bg-accent/10 text-text ring-1 ring-accent"
                    : "border-border bg-bg/50 hover:bg-surface-hover text-text-muted"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Globe className={`w-3.5 h-3.5 ${privacy === "public" ? "text-accent" : ""}`} />
                  <span className="text-xs font-semibold">Public</span>
                </div>
                <span className="text-[10px] opacity-75">Visible to all</span>
              </button>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {privacy === "private" && "Only you"}
              {privacy === "friends" && "People you follow who follow you back"}
              {privacy === "public" && "Anyone, including visitors"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {listToEdit ? "Save Changes" : "Create List"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
