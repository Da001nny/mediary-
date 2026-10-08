"use client";

import React, { useState } from "react";
import { UserPlus, UserCheck, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  onRequireAuth?: () => void;
}

export function FollowButton({
  targetUserId,
  initialIsFollowing = false,
  onFollowChange,
  size = "sm",
  className,
  onRequireAuth,
}: FollowButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // If viewing self, don't show follow button
  if (user && user.id === targetUserId) {
    return null;
  }

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        alert("Please sign in or join meDiary to follow users.");
      }
      return;
    }

    if (isLoading) return;

    // Optimistic Update
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    if (onFollowChange) {
      onFollowChange(nextState);
    }

    setIsLoading(true);

    try {
      const method = nextState ? "POST" : "DELETE";
      const res = await fetch(`/api/users/${targetUserId}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update follow status");
      }
    } catch (err) {
      console.error("Follow action failed, reverting:", err);
      // Revert optimistic update
      setIsFollowing(!nextState);
      if (onFollowChange) {
        onFollowChange(!nextState);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "primary"}
      size={size}
      disabled={isLoading}
      onClick={handleToggleFollow}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "cursor-pointer select-none transition-all duration-150 font-semibold shrink-0",
        isFollowing && isHovered
          ? "border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/60"
          : isFollowing
          ? "border-border text-text-muted hover:text-text hover:border-border"
          : "shadow-xs",
        className
      )}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Updating...</span>
        </span>
      ) : isFollowing ? (
        isHovered ? (
          <span className="inline-flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5 text-red-500" />
            <span>Unfollow</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-accent" />
            <span>Following</span>
          </span>
        )
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Follow</span>
        </span>
      )}
    </Button>
  );
}
