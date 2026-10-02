import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    return NextResponse.json({
      list: {
        ...rawList,
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
 * Updates list details (name, description, is_ranked, privacy).
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

    if (body.name !== undefined) updatePayload.name = String(body.name).trim();
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.is_ranked !== undefined) updatePayload.is_ranked = Boolean(body.is_ranked);
    if (body.privacy !== undefined) updatePayload.privacy = body.privacy;

    const { data, error } = await supabase
      .from("lists")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ list: data });
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in DELETE /api/lists/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
