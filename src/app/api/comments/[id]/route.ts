import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/comments/[id]
 * Deletes a comment. Allowed if caller is:
 * 1. The comment's author (user_id = auth.uid())
 * 2. The owner of the target entry or list
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: true, isMock: true });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 1. Fetch the comment to verify authorization
    const { data: comment, error: fetchErr } = await supabase
      .from("comments")
      .select("id, user_id, entry_id, list_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !comment) {
      return NextResponse.json(
        { error: "Comment not found or not accessible" },
        { status: 404 }
      );
    }

    // 2. Check permission:
    // User is author
    let isAuthorized = comment.user_id === user.id;

    // Or user is target entry owner
    if (!isAuthorized && comment.entry_id) {
      const { data: targetEntry } = await supabase
        .from("entries")
        .select("user_id")
        .eq("id", comment.entry_id)
        .maybeSingle();
      if (targetEntry?.user_id === user.id) {
        isAuthorized = true;
      }
    }

    // Or user is target list owner
    if (!isAuthorized && comment.list_id) {
      const { data: targetList } = await supabase
        .from("lists")
        .select("user_id")
        .eq("id", comment.list_id)
        .maybeSingle();
      if (targetList?.user_id === user.id) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to delete this comment" },
        { status: 403 }
      );
    }

    // 3. Delete the comment (Postgres CASCADE deletes replies)
    const { error: deleteErr } = await supabase
      .from("comments")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      console.error("Error deleting comment:", deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/comments/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
