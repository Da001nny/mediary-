import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordFollowActivity, removeActivity } from "@/lib/activity";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json({ success: true, isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to follow users" },
        { status: 401 }
      );
    }

    if (user.id === targetUserId) {
      return NextResponse.json(
        { error: "You cannot follow yourself" },
        { status: 400 }
      );
    }

    // Insert follow
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

    if (error && error.code !== "23505") {
      // 23505 = already following, treat as success
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Record 'followed' activity if follower's profile_visibility is public
    await recordFollowActivity({
      followerId: user.id,
      followingId: targetUserId,
      client: supabase,
    });

    return NextResponse.json({ success: true, isFollowing: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json({ success: true, isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to unfollow users" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Remove 'followed' activity row
    await removeActivity({
      userId: user.id,
      refId: targetUserId,
      type: "followed",
      client: supabase,
    });

    return NextResponse.json({ success: true, isFollowing: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
