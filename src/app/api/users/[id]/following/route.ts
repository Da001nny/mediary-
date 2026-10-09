import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const db = admin || supabase;
    if (!db) {
      return NextResponse.json({ following: [] });
    }

    let currentUserId: string | null = null;
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUserId = user?.id || null;
    }

    // Check target user's visibility: private profiles hide following unless viewer is owner
    const { data: targetProfile, error: tpErr } = await db
      .from("profiles")
      .select("id, profile_visibility, default_privacy")
      .eq("id", targetUserId)
      .maybeSingle();

    if (tpErr || !targetProfile) {
      return NextResponse.json({ following: [] });
    }

    const isOwner = Boolean(currentUserId && currentUserId === targetUserId);
    const targetVisibility =
      targetProfile.profile_visibility ||
      (targetProfile.default_privacy === "private" ? "private" : "public");

    if (targetVisibility === "private" && !isOwner) {
      return NextResponse.json({ following: [] });
    }

    // Query follows where follower_id = targetUserId
    // If viewer is owner, admin or supabase will retrieve all rows because owner is follower_id
    // If viewer is not owner, use user-scoped client so RLS filters out rows viewer cannot see
    const followDb = isOwner && admin ? admin : (supabase || db);
    const { data: followRows, error } = await followDb
      .from("follows")
      .select("following_id, created_at")
      .eq("follower_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!followRows || followRows.length === 0) {
      return NextResponse.json({ following: [] });
    }

    const followingIds = followRows.map((r) => r.following_id);

    // Fetch profile details for these users (use admin if available to get details for owner)
    const profileDb = isOwner && admin ? admin : db;
    const { data: profiles, error: pErr } = await profileDb
      .from("profiles")
      .select("id, display_name, avatar_url, bio, profile_visibility, default_privacy")
      .in("id", followingIds);

    if (pErr) {
      console.warn("Could not query full profiles table, falling back to safe_profiles:", pErr.message);
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // For any followed user whose profile row was inaccessible under RLS (e.g. private user),
    // retrieve non-sensitive card details from the safe_profiles view
    const missingIds = followingIds.filter((id) => !profileMap.has(id));
    if (missingIds.length > 0) {
      const { data: safeProfiles } = await db
        .from("safe_profiles")
        .select("id, display_name, avatar_url")
        .in("id", missingIds);

      if (safeProfiles) {
        for (const sp of safeProfiles) {
          profileMap.set(sp.id, {
            id: sp.id,
            display_name: sp.display_name,
            avatar_url: sp.avatar_url,
            bio: null,
            profile_visibility: "private" as const,
            default_privacy: "private" as const,
          });
        }
      }
    }

    // Check which ones the current viewer follows
    let viewerFollowingSet = new Set<string>();
    if (currentUserId) {
      const { data: viewerFollows } = await (supabase || db)
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .in("following_id", followingIds);

      if (viewerFollows) {
        viewerFollowingSet = new Set(viewerFollows.map((f) => f.following_id));
      }
    }

    // Build the final following list: never drop a valid follow row for the owner!
    const result = followRows.map((r) => {
      const p = profileMap.get(r.following_id);
      const pVis =
        p?.profile_visibility ||
        (p?.default_privacy === "private" ? "private" : "public");
      const hideBio = pVis === "private" && r.following_id !== currentUserId;
      return {
        id: r.following_id,
        display_name: p?.display_name || "Community Member",
        avatar_url: p?.avatar_url || null,
        bio: hideBio ? null : (p?.bio || null),
        isFollowing: viewerFollowingSet.has(r.following_id),
        isSelf: currentUserId === r.following_id,
      };
    });

    return NextResponse.json({ following: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
