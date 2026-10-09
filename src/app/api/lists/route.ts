import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PrivacyLevel } from "@/types/database.types";

/**
 * GET /api/lists
 * Retrieves lists accessible to the caller:
 * - If authenticated: their own lists + public lists
 * - If unauthenticated: public lists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdFilter = searchParams.get("user_id");
    const privacyFilter = searchParams.get("privacy");

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ lists: [], isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from("lists").select(
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
          community_rating_avg
        )
      )
    `
    );

    if (userIdFilter) {
      query = query.eq("user_id", userIdFilter);
      if (!user || user.id !== userIdFilter) {
        let isMutualFriend = false;
        if (user) {
          const { data: mutuals } = await supabase
            .from("follows")
            .select("follower_id, following_id")
            .or(
              `and(follower_id.eq.${user.id},following_id.eq.${userIdFilter}),and(follower_id.eq.${userIdFilter},following_id.eq.${user.id})`
            );
          if (Array.isArray(mutuals) && mutuals.length === 2) {
            isMutualFriend = true;
          }
        }

        if (isMutualFriend) {
          query = query.in("privacy", ["public", "friends"]);
        } else {
          query = query.eq("privacy", "public");
        }
      }
    } else if (privacyFilter && ["public", "friends", "private"].includes(privacyFilter)) {
      query = query.eq("privacy", privacyFilter as PrivacyLevel);
    } else if (user) {
      // User's own lists OR public lists
      query = query.or(`user_id.eq.${user.id},privacy.eq.public`);
    } else {
      query = query.eq("privacy", "public");
    }

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching lists:", error);
      return NextResponse.json({ lists: [], error: error.message }, { status: 500 });
    }

    // Process lists to include preview_covers and item_count
    interface RawListItem {
      id: string;
      position: number;
      notes: string | null;
      added_at: string;
      media?: {
        cover_url?: string | null;
      } | null;
    }

    interface RawList {
      id: string;
      items?: RawListItem[];
      [key: string]: unknown;
    }

    const formattedLists = ((data as unknown as RawList[]) || []).map((list) => {
      const items = (list.items || []).sort(
        (a, b) => a.position - b.position
      );
      const previewCovers = items
        .map((it) => it.media?.cover_url)
        .filter((c): c is string => Boolean(c))
        .slice(0, 4);

      return {
        ...list,
        items,
        item_count: items.length,
        preview_covers: previewCovers,
      };
    });

    return NextResponse.json({ lists: formattedLists });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in GET /api/lists:", err);
    return NextResponse.json({ lists: [], error: message }, { status: 500 });
  }
}

/**
 * POST /api/lists
 * Creates a new custom list for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to create a list" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description = null, is_ranked = false, privacy = "public" } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "List name is required" },
        { status: 400 }
      );
    }

    const validPrivacies: PrivacyLevel[] = ["public", "friends", "private"];
    const resolvedPrivacy = validPrivacies.includes(privacy) ? privacy : "public";

    const { data, error } = await supabase
      .from("lists")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description ? description.trim() : null,
        is_ranked: Boolean(is_ranked),
        privacy: resolvedPrivacy,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating list:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ list: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in POST /api/lists:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
