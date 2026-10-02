import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/lists/[id]/items
 * Adds a media item to the specified list.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: listId } = await params;
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

    // Verify user owns the list
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id, user_id")
      .eq("id", listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    if (list.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { media_id, position, notes = null } = body;

    if (!media_id) {
      return NextResponse.json(
        { error: "media_id is required" },
        { status: 400 }
      );
    }

    // Determine position if not explicitly supplied
    let targetPosition = position;
    if (typeof targetPosition !== "number") {
      const { count } = await supabase
        .from("list_items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      targetPosition = (count || 0) + 1;
    }

    const { data, error } = await supabase
      .from("list_items")
      .upsert(
        {
          list_id: listId,
          media_id,
          position: targetPosition,
          notes,
        },
        { onConflict: "list_id,media_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error adding item to list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in POST /api/lists/[id]/items:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/lists/[id]/items?media_id=UUID
 * Removes an item from the list.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: listId } = await params;
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("media_id");
    const itemId = searchParams.get("item_id");

    if (!mediaId && !itemId) {
      return NextResponse.json(
        { error: "media_id or item_id is required" },
        { status: 400 }
      );
    }

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

    // Verify ownership
    const { data: list } = await supabase
      .from("lists")
      .select("id, user_id")
      .eq("id", listId)
      .single();

    if (!list || list.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let deleteQuery = supabase.from("list_items").delete().eq("list_id", listId);

    if (itemId) {
      deleteQuery = deleteQuery.eq("id", itemId);
    } else if (mediaId) {
      deleteQuery = deleteQuery.eq("media_id", mediaId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error("Error removing item from list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in DELETE /api/lists/[id]/items:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
