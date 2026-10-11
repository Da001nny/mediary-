import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_ALLOWED_MEDIA_TYPES } from "@/lib/social";

/**
 * GET /api/likes
 * Retrieves like count and user's liked status for a target (entry_id or list_id),
 * or for batch lookup via comma-separated entry_ids / list_ids.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entry_id");
    const listId = searchParams.get("list_id");
    const batchEntryIds = searchParams.get("entry_ids");
    const batchListIds = searchParams.get("list_ids");

    const supabase = await createClient();

    // 1. Batch lookup for multiple entries
    if (batchEntryIds) {
      const ids = batchEntryIds.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ counts: {}, liked: {} });
      }

      if (!supabase) {
        return NextResponse.json({ counts: {}, liked: {}, isMock: true });
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: allLikes, error } = await supabase
        .from("likes")
        .select("entry_id, user_id")
        .in("entry_id", ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const counts: Record<string, number> = {};
      const liked: Record<string, boolean> = {};

      for (const id of ids) {
        counts[id] = 0;
        liked[id] = false;
      }

      for (const row of allLikes || []) {
        if (row.entry_id) {
          counts[row.entry_id] = (counts[row.entry_id] || 0) + 1;
          if (user && row.user_id === user.id) {
            liked[row.entry_id] = true;
          }
        }
      }

      return NextResponse.json({ counts, liked });
    }

    // 2. Batch lookup for multiple lists
    if (batchListIds) {
      const ids = batchListIds.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ counts: {}, liked: {} });
      }

      if (!supabase) {
        return NextResponse.json({ counts: {}, liked: {}, isMock: true });
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: allLikes, error } = await supabase
        .from("likes")
        .select("list_id, user_id")
        .in("list_id", ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const counts: Record<string, number> = {};
      const liked: Record<string, boolean> = {};

      for (const id of ids) {
        counts[id] = 0;
        liked[id] = false;
      }

      for (const row of allLikes || []) {
        if (row.list_id) {
          counts[row.list_id] = (counts[row.list_id] || 0) + 1;
          if (user && row.user_id === user.id) {
            liked[row.list_id] = true;
          }
        }
      }

      return NextResponse.json({ counts, liked });
    }

    // 3. Single target query
    if (!entryId && !listId) {
      return NextResponse.json(
        { error: "entry_id or list_id query parameter is required" },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ count: 0, isLiked: false, isMock: true });
    }

    const { data: { user } } = await supabase.auth.getUser();

    let countQuery = supabase
      .from("likes")
      .select("*", { count: "exact", head: true });

    if (entryId) {
      countQuery = countQuery.eq("entry_id", entryId);
    } else if (listId) {
      countQuery = countQuery.eq("list_id", listId);
    }

    const { count, error: countErr } = await countQuery;

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    let isLiked = false;
    if (user) {
      let userQuery = supabase
        .from("likes")
        .select("id")
        .eq("user_id", user.id);

      if (entryId) {
        userQuery = userQuery.eq("entry_id", entryId);
      } else if (listId) {
        userQuery = userQuery.eq("list_id", listId);
      }

      const { data: userLike } = await userQuery.maybeSingle();
      isLiked = Boolean(userLike);
    }

    return NextResponse.json({ count: count || 0, isLiked });
  } catch (err) {
    console.error("GET /api/likes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/likes
 * Likes an entry or a list.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: true, isLiked: true, count: 1, isMock: true });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required to like items" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entry_id, list_id } = body;

    // Validate that exactly one of entry_id / list_id is set
    if ((!entry_id && !list_id) || (entry_id && list_id)) {
      return NextResponse.json(
        { error: "Exactly one of entry_id or list_id must be provided" },
        { status: 400 }
      );
    }

    // If entry_id, check media-type restriction (movie and TV entries only)
    if (entry_id) {
      const { data: entry, error: entryErr } = await supabase
        .from("entries")
        .select("id, media:media(id, type)")
        .eq("id", entry_id)
        .maybeSingle();

      if (entryErr || !entry) {
        return NextResponse.json(
          { error: "Entry not found or not readable" },
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

    // Insert like
    const { error: insertErr } = await supabase.from("likes").insert({
      user_id: user.id,
      entry_id: entry_id || null,
      list_id: list_id || null,
    });

    if (insertErr && insertErr.code !== "23505") {
      // 23505 = unique violation (already liked)
      console.error("Error inserting like:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Get updated count
    let countQuery = supabase
      .from("likes")
      .select("*", { count: "exact", head: true });

    if (entry_id) {
      countQuery = countQuery.eq("entry_id", entry_id);
    } else {
      countQuery = countQuery.eq("list_id", list_id);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      isLiked: true,
      count: count || 1,
    });
  } catch (err) {
    console.error("POST /api/likes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/likes
 * Unlikes an entry or a list.
 */
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ success: true, isLiked: false, count: 0, isMock: true });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required to unlike items" },
        { status: 401 }
      );
    }

    let deleteQuery = supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id);

    if (entryId) {
      deleteQuery = deleteQuery.eq("entry_id", entryId);
    } else if (listId) {
      deleteQuery = deleteQuery.eq("list_id", listId);
    }

    const { error: deleteErr } = await deleteQuery;

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // Get updated count
    let countQuery = supabase
      .from("likes")
      .select("*", { count: "exact", head: true });

    if (entryId) {
      countQuery = countQuery.eq("entry_id", entryId);
    } else if (listId) {
      countQuery = countQuery.eq("list_id", listId);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      isLiked: false,
      count: count || 0,
    });
  } catch (err) {
    console.error("DELETE /api/likes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
