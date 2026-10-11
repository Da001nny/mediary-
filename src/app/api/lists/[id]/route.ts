import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordListActivity, removeActivity } from "@/lib/activity";
import type { TablesUpdate } from "@/types/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/lists/[id]
 * Retrieves a single custom list with its items and media metadata.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ list: null, isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: list, error } = await supabase
      .from("lists")
      .select(
        `
        *,
        owner:profiles(id, display_name, avatar_url),
        items:list_items(
          id,
          position,
          notes,
          added_at,
          media:media(
            id,
            type,
            title,
            cover_url,
            release_date,
            genres,
            synopsis,
            community_rating_avg,
            community_rating_count,
            type_specific,
            external_ids
          )
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Check privacy
    if (list.privacy === "private" && (!user || user.id !== list.user_id)) {
      return NextResponse.json(
        { error: "This list is private" },
        { status: 403 }
      );
    }

    if (list.privacy === "friends" && (!user || user.id !== list.user_id)) {
      let isMutualFriend = false;
      if (user) {
        const { data: mutuals } = await supabase
          .from("follows")
          .select("follower_id, following_id")
          .or(
            `and(follower_id.eq.${user.id},following_id.eq.${list.user_id}),and(follower_id.eq.${list.user_id},following_id.eq.${user.id})`
          );
        if (Array.isArray(mutuals) && mutuals.length === 2) {
          isMutualFriend = true;
        }
      }

      if (!isMutualFriend) {
        return NextResponse.json(
          { error: "This list is visible only to friends (mutual follows)" },
          { status: 403 }
        );
      }
    }

    // Sort items by position
    interface RawListItem {
      id: string;
      position: number;
      notes: string | null;
      added_at: string;
      media?: {
        cover_url?: string | null;
      } | null;
    }

    const rawList = list as unknown as {
      id: string;
      items?: RawListItem[];
      [key: string]: unknown;
    };

    const sortedItems = (rawList.items || []).sort(
      (a, b) => a.position - b.position
    );

    const previewCovers = sortedItems
      .map((it) => it.media?.cover_url)
      .filter((c): c is string => Boolean(c))
      .slice(0, 4);

    const listTitle = ((rawList as Record<string, unknown>).title || (rawList as Record<string, unknown>).name || "Untitled List") as string;

    return NextResponse.json({
      list: {
        ...rawList,
        title: listTitle,
        name: listTitle,
        items: sortedItems,
        item_count: sortedItems.length,
        preview_covers: previewCovers,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in GET /api/lists/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/lists/[id]
 * Updates list details (title/name, description, is_ranked, privacy).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updatePayload: TablesUpdate<"lists"> = {};

    const listTitle = body.title !== undefined ? body.title : body.name;
    if (listTitle !== undefined) {
      updatePayload.title = String(listTitle).trim();
    }
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.is_ranked !== undefined) updatePayload.is_ranked = Boolean(body.is_ranked);
    if (body.privacy !== undefined) updatePayload.privacy = body.privacy;

    let { data, error } = await supabase
      .from("lists")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    // Fallback if schema has name instead of title
    if (error && (error.message.includes("title") || error.code === "42703") && listTitle !== undefined) {
      const fallbackPayload: TablesUpdate<"lists"> = { ...updatePayload };
      delete fallbackPayload.title;
      const retryResult = await supabase
        .from("lists")
        .update(fallbackPayload)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error("Error updating list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      const savedTitle = ((data as Record<string, unknown>).title || (data as Record<string, unknown>).name || (listTitle ? String(listTitle).trim() : "")) as string;
      await recordListActivity({
        userId: user.id,
        listId: data.id,
        privacy: data.privacy,
        title: savedTitle,
        description: data.description,
        createdAt: data.created_at,
        client: supabase,
      });
    }

    const resList = data
      ? {
          ...data,
          title: (data as Record<string, unknown>).title || (data as Record<string, unknown>).name,
          name: (data as Record<string, unknown>).title || (data as Record<string, unknown>).name,
        }
      : data;

    return NextResponse.json({ list: resList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in PATCH /api/lists/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/lists/[id]
 * Deletes a custom list owned by the user.
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
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("lists")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await removeActivity({
      userId: user.id,
      refId: id,
      client: supabase,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in DELETE /api/lists/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
