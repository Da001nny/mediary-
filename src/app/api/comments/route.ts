import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SOCIAL_ALLOWED_MEDIA_TYPES,
  checkCommentRateLimit,
  CommentWithReplies,
} from "@/lib/social";

/**
 * GET /api/comments?entry_id=UUID or ?list_id=UUID
 * Returns comments newest last (chronological created_at ASC),
 * nested with 1 level of replies.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entry_id");
    const listId = searchParams.get("list_id");

    if ((!entryId && !listId) || (entryId && listId)) {
      return NextResponse.json(
        { error: "Exactly one of entry_id or list_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ comments: [], count: 0, isTargetOwner: false, isMock: true });
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Determine target owner for UI delete controls
    let isTargetOwner = false;
    if (user) {
      if (entryId) {
        const { data: targetEntry } = await supabase
          .from("entries")
          .select("user_id")
          .eq("id", entryId)
          .maybeSingle();
        if (targetEntry?.user_id === user.id) isTargetOwner = true;
      } else if (listId) {
        const { data: targetList } = await supabase
          .from("lists")
          .select("user_id")
          .eq("id", listId)
          .maybeSingle();
        if (targetList?.user_id === user.id) isTargetOwner = true;
      }
    }

    // Query comments (newest last: created_at ASC)
    let query = supabase
      .from("comments")
      .select("id, user_id, entry_id, list_id, parent_id, body, created_at")
      .order("created_at", { ascending: true });

    if (entryId) {
      query = query.eq("entry_id", entryId);
    } else if (listId) {
      query = query.eq("list_id", listId);
    }

    const { data: rawComments, error: commentsErr } = await query;

    if (commentsErr) {
      return NextResponse.json({ error: commentsErr.message }, { status: 500 });
    }

    if (!rawComments || rawComments.length === 0) {
      return NextResponse.json({ comments: [], count: 0, isTargetOwner });
    }

    // Hydrate author profiles
    const authorIds = Array.from(new Set(rawComments.map((c) => c.user_id)));
    const { data: profiles } = await supabase
      .from("safe_profiles")
      .select("id, display_name, avatar_url")
      .in("id", authorIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Structure into flat top-level comments and 1-level replies
    const topLevelComments: CommentWithReplies[] = [];
    const repliesByParentId = new Map<string, CommentWithReplies[]>();

    for (const c of rawComments) {
      const author = profileMap.get(c.user_id);
      const commentItem: CommentWithReplies = {
        id: c.id,
        user_id: c.user_id,
        entry_id: c.entry_id,
        list_id: c.list_id,
        parent_id: c.parent_id,
        body: c.body,
        created_at: c.created_at,
        author: {
          id: c.user_id,
          display_name: author?.display_name || "Community Member",
          avatar_url: author?.avatar_url || null,
        },
      };

      if (!c.parent_id) {
        topLevelComments.push(commentItem);
      } else {
        const existing = repliesByParentId.get(c.parent_id) || [];
        existing.push(commentItem);
        repliesByParentId.set(c.parent_id, existing);
      }
    }

    // Attach replies to top-level comments
    for (const top of topLevelComments) {
      top.replies = repliesByParentId.get(top.id) || [];
    }

    return NextResponse.json({
      comments: topLevelComments,
      count: rawComments.length,
      isTargetOwner,
    });
  } catch (err) {
    console.error("GET /api/comments error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comments
 * Creates a comment or a 1-level reply.
 * Rate limited to 10 comments per minute per user (429).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required to leave a comment" },
        { status: 401 }
      );
    }

    // 1. Rate Limiting Check (10 comments per minute per user)
    const rateCheck = checkCommentRateLimit(user.id);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `You are commenting too fast. Please wait ${rateCheck.retryAfterSeconds}s before commenting again.`,
          retryAfter: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) },
        }
      );
    }

    const body = await request.json();
    const { entry_id, list_id, parent_id, body: rawBody } = body;

    // 2. Validate Target
    if ((!entry_id && !list_id) || (entry_id && list_id)) {
      return NextResponse.json(
        { error: "Exactly one of entry_id or list_id must be provided" },
        { status: 400 }
      );
    }

    // 3. Validate Body (1 to 1000 characters after trimming)
    const trimmedBody = typeof rawBody === "string" ? rawBody.trim() : "";
    if (trimmedBody.length < 1 || trimmedBody.length > 1000) {
      return NextResponse.json(
        { error: "Comment body must be between 1 and 1000 characters." },
        { status: 400 }
      );
    }

    // 4. Validate Media Type for entries (Movie & TV entries only)
    if (entry_id) {
      const { data: entry, error: entryErr } = await supabase
        .from("entries")
        .select("id, media:media(id, type)")
        .eq("id", entry_id)
        .maybeSingle();

      if (entryErr || !entry) {
        return NextResponse.json(
          { error: "Target entry not found or not readable" },
          { status: 404 }
        );
      }

      const mediaType = (entry.media as { type?: string } | null)?.type;
      if (mediaType && !SOCIAL_ALLOWED_MEDIA_TYPES.includes(mediaType as "movie" | "tv")) {
        return NextResponse.json(
          { error: "Likes and comments are currently available for movies and TV shows only." },
          { status: 400 }
        );
      }
    }

    // 5. Enforce 1-level reply rule:
    // A reply's parent must itself be a top-level comment (parent_id is null)
    if (parent_id) {
      const { data: parentComment, error: parentErr } = await supabase
        .from("comments")
        .select("id, parent_id, entry_id, list_id")
        .eq("id", parent_id)
        .maybeSingle();

      if (parentErr || !parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }

      if (parentComment.parent_id !== null) {
        return NextResponse.json(
          { error: "Replies are one level only. You cannot reply to a reply." },
          { status: 400 }
        );
      }

      // Check same target
      if (entry_id && parentComment.entry_id !== entry_id) {
        return NextResponse.json(
          { error: "Parent comment belongs to a different entry" },
          { status: 400 }
        );
      }
      if (list_id && parentComment.list_id !== list_id) {
        return NextResponse.json(
          { error: "Parent comment belongs to a different list" },
          { status: 400 }
        );
      }
    }

    // 6. Insert Comment
    const { data: newComment, error: insertErr } = await supabase
      .from("comments")
      .insert({
        user_id: user.id,
        entry_id: entry_id || null,
        list_id: list_id || null,
        parent_id: parent_id || null,
        body: trimmedBody,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error creating comment:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Hydrate author profile for immediate display
    const { data: authorProfile } = await supabase
      .from("safe_profiles")
      .select("id, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const formatted: CommentWithReplies = {
      id: newComment.id,
      user_id: newComment.user_id,
      entry_id: newComment.entry_id,
      list_id: newComment.list_id,
      parent_id: newComment.parent_id,
      body: newComment.body,
      created_at: newComment.created_at,
      author: {
        id: user.id,
        display_name: authorProfile?.display_name || user.user_metadata?.full_name || "You",
        avatar_url: authorProfile?.avatar_url || null,
      },
      replies: [],
    };

    return NextResponse.json({ success: true, comment: formatted }, { status: 201 });
  } catch (err) {
    console.error("POST /api/comments error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
