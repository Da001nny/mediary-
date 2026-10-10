import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FEED_ALLOWED_MEDIA_TYPES } from "@/lib/activity";

export interface FeedItem {
  id: string;
  user_id: string;
  type: string;
  ref_id: string | null;
  privacy: string;
  media_id: string | null;
  media_type: string | null;
  created_at: string;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  media: {
    id: string;
    type: string;
    title: string;
    cover_url: string | null;
    release_date: string | null;
  } | null;
  rating: number | null;
  review: string | null;
  contains_spoilers: boolean;
  status: string;
  data?: Record<string, unknown>;
}

// Sample mock items for preview / demo environments
const SAMPLE_FEED_ITEMS: FeedItem[] = [
  {
    id: "sample-feed-1",
    user_id: "demo-user-clara",
    type: "reviewed",
    ref_id: "entry-sample-1",
    privacy: "public",
    media_id: "movie-157336",
    media_type: "movie",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45m ago
    user: {
      id: "demo-user-clara",
      display_name: "Clara Oswald",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
    media: {
      id: "movie-157336",
      type: "movie",
      title: "Interstellar",
      cover_url: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      release_date: "2014-11-05",
    },
    rating: 95,
    review: "The docking sequence and Zimmer organ score remain completely unmatched in modern cinema.",
    contains_spoilers: false,
    status: "completed",
  },
  {
    id: "sample-feed-2",
    user_id: "demo-user-marcus",
    type: "logged",
    ref_id: "entry-sample-2",
    privacy: "public",
    media_id: "tv-95557",
    media_type: "tv",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3h ago
    user: {
      id: "demo-user-marcus",
      display_name: "Marcus Vance",
      avatar_url: null,
    },
    media: {
      id: "tv-95557",
      type: "tv",
      title: "Severance",
      cover_url: "https://image.tmdb.org/t/p/w342/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg",
      release_date: "2022-02-18",
    },
    rating: 90,
    review: null,
    contains_spoilers: false,
    status: "in_progress",
  },
  {
    id: "sample-feed-3",
    user_id: "demo-user-elena",
    type: "reviewed",
    ref_id: "entry-sample-3",
    privacy: "public",
    media_id: "movie-550",
    media_type: "movie",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8h ago
    user: {
      id: "demo-user-elena",
      display_name: "Elena Rostova",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    },
    media: {
      id: "movie-550",
      type: "movie",
      title: "Fight Club",
      cover_url: "https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      release_date: "1999-10-15",
    },
    rating: 88,
    review: "The narrator and Tyler Durden reveal changes every detail on a second watch.",
    contains_spoilers: true,
    status: "completed",
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 50);

    const supabase = await createClient();
    if (!supabase) {
      // Mock / fallback
      return NextResponse.json({
        items: SAMPLE_FEED_ITEMS,
        hasMore: false,
        nextCursor: null,
        followingCount: 3,
        isMock: true,
      });
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

    // 1. Fetch people the signed-in user follows
    const { data: followRows, error: followErr } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    if (followErr) {
      console.error("Error loading following users for feed:", followErr);
      return NextResponse.json(
        { error: followErr.message },
        { status: 500 }
      );
    }

    const followingIds = (followRows || []).map((f) => f.following_id);

    // Empty state: You follow nobody
    if (followingIds.length === 0) {
      return NextResponse.json({
        items: [],
        hasMore: false,
        nextCursor: null,
        followingCount: 0,
        reason: "no_following",
      });
    }

    // 2. Query activity rows
    // Only movie and TV items as controlled by FEED_ALLOWED_MEDIA_TYPES constant
    // Ordered newest first (created_at DESC)
    // Cursor pagination on created_at (not offset)
    let activityQuery = supabase
      .from("activity")
      .select("id, user_id, type, ref_id, privacy, media_id, media_type, data, created_at")
      .in("user_id", followingIds)
      .in("media_type", [...FEED_ALLOWED_MEDIA_TYPES])
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      activityQuery = activityQuery.lt("created_at", cursor);
    }

    const { data: rawActivities, error: actErr } = await activityQuery;

    if (actErr) {
      console.error("Error querying activity feed:", actErr);
      return NextResponse.json(
        { error: actErr.message },
        { status: 500 }
      );
    }

    if (!rawActivities || rawActivities.length === 0) {
      return NextResponse.json({
        items: [],
        hasMore: false,
        nextCursor: null,
        followingCount: followingIds.length,
        reason: "no_activity",
      });
    }

    const hasMore = rawActivities.length > limit;
    const pageRows = hasMore ? rawActivities.slice(0, limit) : rawActivities;
    const nextCursor = pageRows.length > 0 ? pageRows[pageRows.length - 1].created_at : null;

    // 3. Hydrate authors, media metadata, and entries
    const authorIds = Array.from(new Set(pageRows.map((r) => r.user_id)));
    const mediaIds = Array.from(
      new Set(pageRows.map((r) => r.media_id).filter((id): id is string => Boolean(id)))
    );
    const entryIds = Array.from(
      new Set(
        pageRows
          .filter((r) => r.type === "logged" || r.type === "reviewed")
          .map((r) => r.ref_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    // Fetch author profiles
    const [profilesRes, mediaRes, entriesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, profile_visibility")
        .in("id", authorIds),
      mediaIds.length > 0
        ? supabase
            .from("media")
            .select("id, type, title, cover_url, release_date")
            .in("id", mediaIds)
        : Promise.resolve({ data: [] }),
      entryIds.length > 0
        ? supabase
            .from("entries")
            .select("id, rating, review, contains_spoilers, status")
            .in("id", entryIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(
      (profilesRes.data || []).map((p) => [p.id, p])
    );
    const mediaMap = new Map(
      (mediaRes.data || []).map((m) => [m.id, m])
    );
    const entryMap = new Map(
      (entriesRes.data || []).map((e) => [e.id, e])
    );

    const items: FeedItem[] = pageRows.map((row) => {
      const author = profileMap.get(row.user_id);
      const media = row.media_id ? mediaMap.get(row.media_id) : null;
      const entry = row.ref_id ? entryMap.get(row.ref_id) : null;
      const rowData = (row.data || {}) as Record<string, unknown>;

      return {
        id: row.id,
        user_id: row.user_id,
        type: row.type,
        ref_id: row.ref_id,
        privacy: row.privacy,
        media_id: row.media_id,
        media_type: row.media_type,
        created_at: row.created_at,
        user: {
          id: row.user_id,
          display_name: author?.display_name || "Community Member",
          avatar_url: author?.avatar_url || null,
        },
        media: media
          ? {
              id: media.id,
              type: media.type,
              title: media.title,
              cover_url: media.cover_url,
              release_date: media.release_date,
            }
          : null,
        rating: entry?.rating ?? (rowData.rating as number | null) ?? null,
        review: entry?.review ?? (rowData.review as string | null) ?? null,
        contains_spoilers: Boolean(entry?.contains_spoilers ?? rowData.contains_spoilers),
        status: entry?.status ?? (rowData.status as string) ?? "completed",
        data: rowData,
      };
    });

    return NextResponse.json({
      items,
      hasMore,
      nextCursor,
      followingCount: followingIds.length,
    });
  } catch (err) {
    console.error("GET /api/activity error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
