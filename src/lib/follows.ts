import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database.types";

export interface FollowCounts {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface UserFollowItem {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  isFollowing?: boolean;
}

const LOCAL_STORAGE_FOLLOWS_KEY = "mediary_demo_follows_v1";

interface LocalFollowsState {
  [followerId: string]: string[]; // followerId -> list of followingIds
}

function getLocalFollows(): LocalFollowsState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalFollows(state: LocalFollowsState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_FOLLOWS_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetch follow counts and whether current user follows target user.
 */
export async function getFollowCounts(
  targetUserId: string,
  currentUserId?: string | null
): Promise<FollowCounts> {
  const supabase = createClient();

  if (!supabase) {
    const local = getLocalFollows();
    const following = local[targetUserId] || [];
    let followersCount = 0;
    for (const followerId in local) {
      if (local[followerId]?.includes(targetUserId)) {
        followersCount++;
      }
    }
    const isFollowing = currentUserId
      ? (local[currentUserId] || []).includes(targetUserId)
      : false;

    return {
      followersCount,
      followingCount: following.length,
      isFollowing,
    };
  }

  try {
    // Get followers count
    const { count: followersCount, error: fErr } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", targetUserId);

    // Get following count
    const { count: followingCount, error: gErr } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", targetUserId);

    let isFollowing = false;
    if (currentUserId && currentUserId !== targetUserId) {
      const { data: followRecord } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId)
        .maybeSingle();

      isFollowing = Boolean(followRecord);
    }

    return {
      followersCount: fErr ? 0 : followersCount || 0,
      followingCount: gErr ? 0 : followingCount || 0,
      isFollowing,
    };
  } catch (err) {
    console.error("Error fetching follow counts:", err);
    return { followersCount: 0, followingCount: 0, isFollowing: false };
  }
}

/**
 * Follow a target user
 */
export async function followUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  if (followerId === followingId) {
    return { success: false, error: "You cannot follow yourself" };
  }

  const supabase = createClient();

  if (!supabase) {
    const local = getLocalFollows();
    const current = local[followerId] || [];
    if (!current.includes(followingId)) {
      local[followerId] = [...current, followingId];
      saveLocalFollows(local);
    }
    return { success: true };
  }

  try {
    const { error } = await supabase.from("follows").insert({
      follower_id: followerId,
      following_id: followingId,
    });

    if (error) {
      // 23505 is unique violation (already following)
      if (error.code === "23505") {
        return { success: true };
      }
      throw error;
    }

    return { success: true };
  } catch (err) {
    console.error("Error following user:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to follow user",
    };
  }
}

/**
 * Unfollow a target user
 */
export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  if (!supabase) {
    const local = getLocalFollows();
    const current = local[followerId] || [];
    local[followerId] = current.filter((id) => id !== followingId);
    saveLocalFollows(local);
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Error unfollowing user:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to unfollow user",
    };
  }
}

/**
 * Get list of users following targetUserId
 */
export async function getFollowers(
  targetUserId: string,
  currentUserId?: string | null
): Promise<UserFollowItem[]> {
  const supabase = createClient();

  if (!supabase) {
    return [];
  }

  try {
    // Query follows where following_id = targetUserId, join with profiles
    const { data, error } = await supabase
      .from("follows")
      .select(`
        follower_id,
        created_at,
        profiles!follows_follower_id_fkey(
          id,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq("following_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    let currentUserFollowingSet = new Set<string>();
    if (currentUserId) {
      const { data: myFollows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (myFollows) {
        currentUserFollowingSet = new Set(myFollows.map((f) => f.following_id));
      }
    }

    const items: UserFollowItem[] = [];
    const missingIds: string[] = [];
    for (const row of data || []) {
      const p = (row as unknown as { profiles: Profile | null }).profiles;
      if (p) {
        items.push({
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          isFollowing: currentUserFollowingSet.has(p.id),
        });
      } else if (row.follower_id) {
        missingIds.push(row.follower_id);
      }
    }

    if (missingIds.length > 0) {
      try {
        const { data: safeList } = await supabase
          .from("safe_profiles")
          .select("id, display_name, avatar_url")
          .in("id", missingIds);
        const safeMap = new Map((safeList || []).map((s) => [s.id, s]));
        for (const mId of missingIds) {
          const s = safeMap.get(mId);
          items.push({
            id: mId,
            display_name: s?.display_name || "Community Member",
            avatar_url: s?.avatar_url || null,
            bio: null,
            isFollowing: currentUserFollowingSet.has(mId),
          });
        }
      } catch (safeErr) {
        console.warn("Could not fetch safe_profiles for followers:", safeErr);
        for (const mId of missingIds) {
          items.push({
            id: mId,
            display_name: "Community Member",
            avatar_url: null,
            bio: null,
            isFollowing: currentUserFollowingSet.has(mId),
          });
        }
      }
    }

    return items;
  } catch (err) {
    console.error("Error fetching followers:", err);
    return [];
  }
}

/**
 * Get list of users targetUserId is following
 */
export async function getFollowing(
  targetUserId: string,
  currentUserId?: string | null
): Promise<UserFollowItem[]> {
  const supabase = createClient();

  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("follows")
      .select(`
        following_id,
        created_at,
        profiles!follows_following_id_fkey(
          id,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq("follower_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    let currentUserFollowingSet = new Set<string>();
    if (currentUserId) {
      const { data: myFollows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (myFollows) {
        currentUserFollowingSet = new Set(myFollows.map((f) => f.following_id));
      }
    }

    const items: UserFollowItem[] = [];
    const missingIds: string[] = [];
    for (const row of data || []) {
      const p = (row as unknown as { profiles: Profile | null }).profiles;
      if (p) {
        items.push({
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          isFollowing: currentUserFollowingSet.has(p.id),
        });
      } else if (row.following_id) {
        missingIds.push(row.following_id);
      }
    }

    if (missingIds.length > 0) {
      try {
        const { data: safeList } = await supabase
          .from("safe_profiles")
          .select("id, display_name, avatar_url")
          .in("id", missingIds);
        const safeMap = new Map((safeList || []).map((s) => [s.id, s]));
        for (const mId of missingIds) {
          const s = safeMap.get(mId);
          items.push({
            id: mId,
            display_name: s?.display_name || "Community Member",
            avatar_url: s?.avatar_url || null,
            bio: null,
            isFollowing: currentUserFollowingSet.has(mId),
          });
        }
      } catch (safeErr) {
        console.warn("Could not fetch safe_profiles for following:", safeErr);
        for (const mId of missingIds) {
          items.push({
            id: mId,
            display_name: "Community Member",
            avatar_url: null,
            bio: null,
            isFollowing: currentUserFollowingSet.has(mId),
          });
        }
      }
    }

    return items;
  } catch (err) {
    console.error("Error fetching following:", err);
    return [];
  }
}
