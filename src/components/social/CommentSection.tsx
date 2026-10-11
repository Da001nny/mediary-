"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MessageSquare,
  CornerDownRight,
  Trash2,
  Send,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { SOCIAL_ALLOWED_MEDIA_TYPES, CommentWithReplies } from "@/lib/social";

interface CommentSectionProps {
  entryId?: string;
  listId?: string;
  mediaType?: string;
  initialIsOpen?: boolean;
  onCountChange?: (count: number) => void;
  className?: string;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function getMonogram(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CommentSection({
  entryId,
  listId,
  mediaType,
  initialIsOpen = true,
  onCountChange,
  className = "",
}: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTargetOwner, setIsTargetOwner] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(initialIsOpen);

  // New comment input state
  const [bodyText, setBodyText] = useState<string>("");
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    authorName: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check media type restriction
  const isMediaTypeAllowed =
    !entryId ||
    !mediaType ||
    SOCIAL_ALLOWED_MEDIA_TYPES.includes(mediaType as "movie" | "tv");

  // Fetch comments
  useEffect(() => {
    let ignore = false;
    async function loadComments() {
      if (!entryId && !listId) return;
      if (!isMediaTypeAllowed) return;

      try {
        setIsLoading(true);
        const query = entryId ? `entry_id=${entryId}` : `list_id=${listId}`;
        const res = await fetch(`/api/comments?${query}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setComments(data.comments || []);
            setTotalCount(data.count ?? 0);
            setIsTargetOwner(Boolean(data.isTargetOwner));
            if (onCountChange) onCountChange(data.count ?? 0);
          }
        }
      } catch (err) {
        console.error("Error loading comments:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadComments();
    return () => {
      ignore = true;
    };
  }, [entryId, listId, isMediaTypeAllowed, onCountChange]);

  if (!isMediaTypeAllowed) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage("Please sign in to join the conversation.");
      return;
    }

    const trimmed = bodyText.trim();
    if (trimmed.length < 1) return;
    if (trimmed.length > 1000) {
      setErrorMessage("Comments cannot exceed 1,000 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: entryId || undefined,
          list_id: listId || undefined,
          parent_id: replyTarget?.id || null,
          body: trimmed,
        }),
      });

      if (res.status === 401) {
        setErrorMessage("Please sign in to leave a comment.");
        return;
      }

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(
          errData.error || "You are commenting too fast. Please wait a moment before trying again."
        );
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to post comment");
      }

      const data = await res.json();
      const newComment: CommentWithReplies = data.comment;

      // Insert into local state (newest last)
      if (newComment.parent_id) {
        // Nested reply
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === newComment.parent_id) {
              return {
                ...c,
                replies: [...(c.replies || []), newComment],
              };
            }
            return c;
          })
        );
      } else {
        // Top-level comment
        setComments((prev) => [...prev, newComment]);
      }

      const newTotal = totalCount + 1;
      setTotalCount(newTotal);
      if (onCountChange) onCountChange(newTotal);

      // Reset form
      setBodyText("");
      setReplyTarget(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong while posting your comment."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string, isReply: boolean, parentId?: string | null) => {
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete comment");
      }

      if (isReply && parentId) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: (c.replies || []).filter((r) => r.id !== commentId),
              };
            }
            return c;
          })
        );
      } else {
        // Top-level comment deleted: remove comment and any nested replies
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }

      // Re-calculate count
      const updatedTotal = Math.max(0, totalCount - 1);
      setTotalCount(updatedTotal);
      if (onCountChange) onCountChange(updatedTotal);
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-t border-border/70 pt-3">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text hover:text-accent transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>
            {totalCount > 0
              ? `${totalCount} ${totalCount === 1 ? "Comment" : "Comments"}`
              : "Discussion"}
          </span>
        </button>

        <span className="text-[11px] text-text-muted font-mono">
          {totalCount} {totalCount === 1 ? "entry" : "entries"}
        </span>
      </div>

      {isOpen && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Skeleton loading */}
          {isLoading && (
            <div className="space-y-2.5 py-1">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-surface/60 border border-border/60 animate-pulse space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-border/60" />
                    <div className="w-24 h-3 bg-border/60 rounded" />
                    <div className="w-12 h-2.5 bg-border/40 rounded" />
                  </div>
                  <div className="w-3/4 h-3 bg-border/40 rounded ml-8" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && comments.length === 0 && (
            <div className="p-4 sm:p-5 rounded-xl border border-dashed border-border/80 bg-surface/30 text-center space-y-1">
              <p className="text-xs font-medium text-text">No comments yet</p>
              <p className="text-[11px] text-text-muted">
                Be the first to share your reflections or thoughts with the community.
              </p>
            </div>
          )}

          {/* Comment Thread (Newest Last) */}
          {!isLoading && comments.length > 0 && (
            <div className="space-y-3">
              {comments.map((comment) => {
                const canDeleteTop =
                  user && (comment.user_id === user.id || isTargetOwner);

                return (
                  <div key={comment.id} className="space-y-2">
                    {/* Top-Level Comment Card */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border/70 hover:border-border transition-all space-y-2 group">
                      <div className="flex items-center justify-between gap-2">
                        {/* Author info */}
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/u/${comment.user_id}`}
                            className="shrink-0 group/avatar"
                          >
                            {comment.author.avatar_url ? (
                              <div className="w-6 h-6 rounded-full overflow-hidden border border-border relative bg-surface">
                                <Image
                                  src={comment.author.avatar_url}
                                  alt={comment.author.display_name}
                                  fill
                                  className="object-cover"
                                  sizes="24px"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-[10px] font-bold font-mono">
                                {getMonogram(comment.author.display_name)}
                              </div>
                            )}
                          </Link>

                          <Link
                            href={`/u/${comment.user_id}`}
                            className="font-serif font-bold text-xs text-text hover:text-accent transition-colors truncate"
                          >
                            {comment.author.display_name}
                          </Link>

                          <span className="text-[10px] font-mono text-text-muted shrink-0">
                            {formatRelativeTime(comment.created_at)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Reply Button (Only on top-level comments) */}
                          <button
                            type="button"
                            onClick={() =>
                              setReplyTarget({
                                id: comment.id,
                                authorName: comment.author.display_name,
                              })
                            }
                            className="text-[11px] font-medium text-text-muted hover:text-accent cursor-pointer px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <CornerDownRight className="w-3 h-3" />
                            <span>Reply</span>
                          </button>

                          {/* Delete Button */}
                          {canDeleteTop && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id, false)}
                              disabled={deletingId === comment.id}
                              className="text-text-muted hover:text-rose-500 cursor-pointer p-1 rounded transition-colors"
                              title="Delete comment"
                            >
                              {deletingId === comment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Plain text body (never HTML) */}
                      <p className="text-xs sm:text-sm text-text/90 font-sans leading-relaxed whitespace-pre-wrap break-words pl-8">
                        {comment.body}
                      </p>
                    </div>

                    {/* 1-Level Nested Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="pl-6 sm:pl-8 space-y-2 border-l-2 border-border/60 ml-3">
                        {comment.replies.map((reply) => {
                          const canDeleteReply =
                            user && (reply.user_id === user.id || isTargetOwner);

                          return (
                            <div
                              key={reply.id}
                              className="p-2.5 sm:p-3 rounded-xl bg-surface/80 border border-border/60 hover:border-border transition-all space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link
                                    href={`/u/${reply.user_id}`}
                                    className="shrink-0"
                                  >
                                    {reply.author.avatar_url ? (
                                      <div className="w-5 h-5 rounded-full overflow-hidden border border-border relative bg-surface">
                                        <Image
                                          src={reply.author.avatar_url}
                                          alt={reply.author.display_name}
                                          fill
                                          className="object-cover"
                                          sizes="20px"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-[9px] font-bold font-mono">
                                        {getMonogram(reply.author.display_name)}
                                      </div>
                                    )}
                                  </Link>

                                  <Link
                                    href={`/u/${reply.user_id}`}
                                    className="font-serif font-bold text-xs text-text hover:text-accent transition-colors truncate"
                                  >
                                    {reply.author.display_name}
                                  </Link>

                                  <span className="text-[10px] font-mono text-text-muted shrink-0">
                                    {formatRelativeTime(reply.created_at)}
                                  </span>
                                </div>

                                {canDeleteReply && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteComment(reply.id, true, comment.id)
                                    }
                                    disabled={deletingId === reply.id}
                                    className="text-text-muted hover:text-rose-500 cursor-pointer p-1 rounded transition-colors"
                                    title="Delete reply"
                                  >
                                    {deletingId === reply.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>

                              <p className="text-xs sm:text-sm text-text/90 font-sans leading-relaxed whitespace-pre-wrap break-words pl-7">
                                {reply.body}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment Form */}
          <form onSubmit={handleSubmit} className="space-y-2 pt-1">
            {/* Replying banner */}
            {replyTarget && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent">
                <span className="flex items-center gap-1.5">
                  <CornerDownRight className="w-3 h-3" />
                  <span>Replying to <strong>{replyTarget.authorName}</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="hover:text-text cursor-pointer p-0.5"
                  title="Cancel reply"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                maxLength={1000}
                placeholder={
                  replyTarget
                    ? `Reply to ${replyTarget.authorName}...`
                    : "Add your thoughts, reflection, or question..."
                }
                rows={2}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none placeholder:text-text-muted/60 transition-all text-text"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-text-muted">
                  {bodyText.trim().length}/1000
                </span>

                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={isSubmitting || bodyText.trim().length === 0}
                  leftIcon={
                    isSubmitting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )
                  }
                >
                  {isSubmitting ? "Posting..." : replyTarget ? "Post Reply" : "Comment"}
                </Button>
              </div>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
