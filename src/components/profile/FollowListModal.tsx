"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Users, UserCheck, Loader2 } from "lucide-react";
import { FollowButton } from "./FollowButton";

export interface UserFollowItem {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  isFollowing?: boolean;
  isSelf?: boolean;
}

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  initialTab?: "followers" | "following";
  followersCount?: number;
  followingCount?: number;
  onRequireAuth?: () => void;
}

export function FollowListModal({
  isOpen,
  onClose,
  userId,
  userName = "User",
  initialTab = "followers",
  followersCount = 0,
  followingCount = 0,
  onRequireAuth,
}: FollowListModalProps) {
  const [activeTab, setActiveTab] = useState<"followers" | "following">(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const [followers, setFollowers] = useState<UserFollowItem[]>([]);
  const [following, setFollowing] = useState<UserFollowItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let cancelled = false;

    const endpoint =
      activeTab === "followers"
        ? `/api/users/${userId}/followers`
        : `/api/users/${userId}/following`;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);

      fetch(endpoint)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load user list");
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (activeTab === "followers") {
            setFollowers(data.followers || []);
          } else {
            setFollowing(data.following || []);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Error loading follow list:", err);
          setError(err instanceof Error ? err.message : "Error loading list");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, activeTab]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentList = activeTab === "followers" ? followers : following;

  const getMonogram = (name: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
    >
      <div className="w-full max-w-md bg-surface border border-border/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] card-depth animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/70 bg-bg/50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="follow-modal-title"
              className="font-serif text-base sm:text-lg font-bold text-text truncate"
            >
              {userName}&rsquo;s Network
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Connect and explore fellow media cataloguer profiles
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-bg border-b border-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("followers")}
            className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "followers"
                ? "bg-surface text-text shadow-2xs font-bold"
                : "text-text-muted hover:text-text"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-accent" />
            <span>Followers</span>
            <span className="font-mono text-[11px] opacity-75">
              ({followersCount})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("following")}
            className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "following"
                ? "bg-surface text-text shadow-2xs font-bold"
                : "text-text-muted hover:text-text"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-accent" />
            <span>Following</span>
            <span className="font-mono text-[11px] opacity-75">
              ({followingCount})
            </span>
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 divide-y divide-border/40">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-text-muted space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <span className="text-xs font-mono">Loading profiles...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-red-500/90 px-4">
              {error}
            </div>
          ) : currentList.length === 0 ? (
            <div className="py-12 text-center text-text-muted space-y-2 px-4">
              <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-text-muted/60">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-xs font-serif font-bold text-text">
                {activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
              <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                {activeTab === "followers"
                  ? "When other members follow this profile, they will appear here."
                  : "When this profile follows other members, they will appear here."}
              </p>
            </div>
          ) : (
            currentList.map((userItem) => (
              <div
                key={userItem.id}
                className="pt-2.5 first:pt-0 flex items-center justify-between gap-3"
              >
                <Link
                  href={`/u/${userItem.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  {/* Avatar or Monogram */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-accent/15 border border-accent/25 text-accent flex items-center justify-center shrink-0 font-serif font-bold text-xs sm:text-sm shadow-2xs group-hover:scale-105 transition-transform">
                    {userItem.avatar_url ? (
                      <Image
                        src={userItem.avatar_url}
                        alt={userItem.display_name || "User"}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{getMonogram(userItem.display_name)}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-text truncate group-hover:text-accent transition-colors">
                      {userItem.display_name || "Anonymous Member"}
                    </p>
                    {userItem.bio ? (
                      <p className="text-[11px] text-text-muted truncate leading-tight">
                        {userItem.bio}
                      </p>
                    ) : (
                      <p className="text-[10px] text-text-muted/60 font-mono">
                        meDiary Member
                      </p>
                    )}
                  </div>
                </Link>

                {/* Follow Button for this user */}
                {!userItem.isSelf && (
                  <FollowButton
                    targetUserId={userItem.id}
                    initialIsFollowing={Boolean(userItem.isFollowing)}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onRequireAuth={onRequireAuth}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
