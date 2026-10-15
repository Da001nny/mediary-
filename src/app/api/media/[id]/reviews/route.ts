import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewItem, EntryStatus, PrivacyLevel } from "@/types/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}



/**
 * GET /api/media/[id]/reviews
 *
 * Retrieves public community reviews for a media item.
 * Supports sorting:
 *   - ?sort=recent (default: newest reviews first)
 *   - ?sort=highest (highest rating first)
 *   - ?sort=lowest (lowest rating first)
 * Supports filtering:
 *   - ?filter=with_text (only entries with non-empty review text, default)
 *   - ?filter=all (all logged entries including rating-only logs)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") || "recent";
    const filter = searchParams.get("filter") || "with_text";

    if (!id) {
      return NextResponse.json({ error: "Media ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient() || supabase;

    let currentUserId: string | null = null;
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUserId = user?.id || null;
    }

    // Resolve UUID in public.media
    let resolvedMediaId: string | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isUuid) {
      resolvedMediaId = id;
    } else if (adminSupabase) {
      // Find media row by external ID
      const cleanNumeric = id.replace(/^[a-z]+-/, "");
      const { data: byTmdb } = await adminSupabase
        .from("media")
        .select("id")
        .filter("external_ids->>tmdb_id", "eq", cleanNumeric)
        .maybeSingle();

      if (byTmdb?.id) {
        resolvedMediaId = byTmdb.id;
      } else {
        const { data: byRawg } = await adminSupabase
          .from("media")
          .select("id")
          .filter("external_ids->>rawg_id", "eq", cleanNumeric)
          .maybeSingle();

        if (byRawg?.id) {
          resolvedMediaId = byRawg.id;
        } else {
          const { data: byGb } = await adminSupabase
            .from("media")
            .select("id")
            .filter("external_ids->>google_books_id", "eq", cleanNumeric)
            .maybeSingle();

          if (byGb?.id) {
            resolvedMediaId = byGb.id;
          }
        }
      }
    }

    const reviews: ReviewItem[] = [];

    // Query database if configured and resolved
    if (adminSupabase && resolvedMediaId) {
      let query = adminSupabase
        .from("entries")
        .select(`
          id,
          user_id,
          media_id,
          status,
          rating,
          progress,
          review,
          privacy,
          created_at,
          updated_at
        `)
        .eq("media_id", resolvedMediaId);

      // Privacy enforcement: public reviews, viewer's own reviews, or mutual friends reviews
      if (currentUserId && adminSupabase) {
        let mutualFriendIds: string[] = [];
        const { data: myFollowing } = await adminSupabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId);
        const myFollowingIds = (myFollowing || []).map((f) => f.following_id);

        if (myFollowingIds.length > 0) {
          const { data: theyFollowMe } = await adminSupabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", currentUserId)
            .in("follower_id", myFollowingIds);
          mutualFriendIds = (theyFollowMe || []).map((f) => f.follower_id);
        }

        if (mutualFriendIds.length > 0) {
          query = query.or(
            `user_id.eq.${currentUserId},privacy.eq.public,and(privacy.eq.friends,user_id.in.(${mutualFriendIds.join(",")}))`
          );
        } else {
          query = query.or(`user_id.eq.${currentUserId},privacy.eq.public`);
        }
      } else {
        query = query.eq("privacy", "public");
      }

      if (filter === "with_text") {
        query = query.not("review", "is", null);
      }

      if (sort === "highest") {
        query = query.order("rating", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      } else if (sort === "lowest") {
        query = query.order("rating", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
      } else {
        // Default: most recent
        query = query.order("created_at", { ascending: false });
      }

      const { data: dbEntries, error: dbError } = await query;

      if (!dbError && Array.isArray(dbEntries) && dbEntries.length > 0) {
        // Collect user_ids to fetch author profiles
        const userIds = Array.from(new Set(dbEntries.map((e) => e.user_id)));
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);

        const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>();
        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.id, {
              display_name: p.display_name || "Community Member",
              avatar_url: p.avatar_url,
            });
          }
        }

        for (const entry of dbEntries) {
          const authorProfile = profileMap.get(entry.user_id);
          const prog = (entry.progress as Record<string, unknown>) || {};
          const hasSpoilers = Boolean(
            (entry as unknown as { contains_spoilers?: boolean }).contains_spoilers ??
            prog.contains_spoilers
          );

          reviews.push({
            id: entry.id,
            user_id: entry.user_id,
            media_id: entry.media_id,
            status: entry.status as EntryStatus,
            rating: entry.rating,
            progress: entry.progress as ReviewItem["progress"],
            review: entry.review,
            contains_spoilers: hasSpoilers,
            privacy: entry.privacy as PrivacyLevel,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            author: {
              display_name: authorProfile?.display_name || "Community Member",
              avatar_url: authorProfile?.avatar_url || null,
            },
          });
        }
      }
    }



    return NextResponse.json({
      reviews,
      totalCount: reviews.length,
      sort,
      filter,
      mediaId: resolvedMediaId || id,
    });
  } catch (err) {
    console.error("GET /api/media/[id]/reviews error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load reviews" },
      { status: 500 }
    );
  }
}
