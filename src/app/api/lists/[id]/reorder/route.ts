import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/lists/[id]/reorder
 * Bulk updates the item positions for a ranked or ordered list.
 * Body: { items: [{ id: string, position: number }] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Verify ownership
    const { data: list } = await supabase
      .from("lists")
      .select("id, user_id")
      .eq("id", listId)
      .single();

    if (!list || list.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      );
    }

    // Update each item position
    const updates = items.map((it: { id: string; position: number }) =>
      supabase
        .from("list_items")
        .update({ position: it.position })
        .eq("id", it.id)
        .eq("list_id", listId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in PUT /api/lists/[id]/reorder:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
