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

    // Query follows where follower_id = targetUserId
    const { data: followRows, error } = await db
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

    // Fetch profile details for these users
    const { data: profiles, error: pErr } = await db
      .from("profiles")
      .select("id, display_name, avatar_url, bio")
      .in("id", followingIds);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Check which ones the current viewer follows
    let viewerFollowingSet = new Set<string>();
    if (currentUserId) {
      const { data: viewerFollows } = await db
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .in("following_id", followingIds);

      if (viewerFollows) {
        viewerFollowingSet = new Set(viewerFollows.map((f) => f.following_id));
      }
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const result = followRows
      .map((r) => {
        const p = profileMap.get(r.following_id);
        if (!p) return null;
        return {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          bio: p.bio,
          isFollowing: viewerFollowingSet.has(p.id),
          isSelf: currentUserId === p.id,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ following: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
