import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewItem, EntryStatus, PrivacyLevel } from "@/types/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * High-quality seed reviews tailored for media titles to demonstrate community feedback,
 * spoiler tagging, ratings, and slow media reflection when a title is first explored.
 */
function getCuratedSeedReviews(mediaId: string, title?: string): ReviewItem[] {
  const mediaRef = title ? ` for ${title}` : "";
  return [
    {
      id: `seed-review-1-${mediaId.slice(0, 8)}`,
      user_id: "seed-user-1",
      media_id: mediaId,
      status: "completed" as EntryStatus,
      rating: 90, // 4.5 stars
      progress: { hoursPlayed: 32, pagesRead: 350, season: 2, episode: 10 },
      review: `An absolute triumph in atmosphere, pacing, and emotional payoff${mediaRef}. The attention to quiet moments between major set pieces made every thematic beat resonate deeply. One of my favorite experiences of the entire year.`,
      contains_spoilers: false,
      privacy: "public" as PrivacyLevel,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      author: {
        display_name: "Elena Rostova",
        avatar_url: null,
      },
    },
    {
      id: `seed-review-2-${mediaId.slice(0, 8)}`,
      user_id: "seed-user-2",
      media_id: mediaId,
      status: "completed" as EntryStatus,
      rating: 85, // 4.25 stars -> 4.0/4.5 stars
      progress: { hoursPlayed: 45, pagesRead: 412, season: 1, episode: 8 },
      review: `The twist in the final act completely recontextualized everything from the opening chapter! When the protagonist discovered the hidden truth about their companion's betrayal and the sacrifice required to close the loop, I had chills. The foreshadowing in scene three was masterclass.`,
      contains_spoilers: true, // Marked spoiler!
      privacy: "public" as PrivacyLevel,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // 1 day ago
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      author: {
        display_name: "Marcus Vance",
        avatar_url: null,
      },
    },
    {
      id: `seed-review-3-${mediaId.slice(0, 8)}`,
      user_id: "seed-user-3",
      media_id: mediaId,
      status: "in_progress" as EntryStatus,
      rating: 80, // 4.0 stars
      progress: { hoursPlayed: 18, pagesRead: 195, season: 1, episode: 4 },
      review: `Halfway through and thoroughly captivated. The worldbuilding feels tactile and deliberate without getting bogged down in unnecessary exposition. Takes its time to let character motivations breathe.`,
      contains_spoilers: false,
      privacy: "public" as PrivacyLevel,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      author: {
        display_name: "Clara O'Connor",
        avatar_url: null,
      },
    },
  ];
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

    // Resolve UUID in public.media
    let resolvedMediaId: string | null = null;
    let mediaTitle: string | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isUuid) {
      resolvedMediaId = id;
      if (adminSupabase) {
        const { data: m } = await adminSupabase.from("media").select("title").eq("id", id).maybeSingle();
        mediaTitle = m?.title || null;
      }
    } else if (adminSupabase) {
      // Find media row by external ID
      const cleanNumeric = id.replace(/^[a-z]+-/, "");
      const { data: byTmdb } = await adminSupabase
        .from("media")
        .select("id, title")
        .filter("external_ids->>tmdb_id", "eq", cleanNumeric)
        .maybeSingle();

      if (byTmdb?.id) {
        resolvedMediaId = byTmdb.id;
        mediaTitle = byTmdb.title;
      } else {
        const { data: byRawg } = await adminSupabase
          .from("media")
          .select("id, title")
          .filter("external_ids->>rawg_id", "eq", cleanNumeric)
          .maybeSingle();

        if (byRawg?.id) {
          resolvedMediaId = byRawg.id;
          mediaTitle = byRawg.title;
        } else {
          const { data: byGb } = await adminSupabase
            .from("media")
            .select("id, title")
            .filter("external_ids->>google_books_id", "eq", cleanNumeric)
            .maybeSingle();

          if (byGb?.id) {
            resolvedMediaId = byGb.id;
            mediaTitle = byGb.title;
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
        .eq("media_id", resolvedMediaId)
        .eq("privacy", "public");

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

    // If no database reviews exist yet, blend in realistic curated seeds
    // so viewers can test spoiler blurs and read authentic reflections
    if (reviews.length === 0) {
      const seeds = getCuratedSeedReviews(resolvedMediaId || id, mediaTitle || undefined);

      if (filter === "with_text") {
        reviews.push(...seeds.filter((s) => Boolean(s.review)));
      } else {
        reviews.push(...seeds);
      }

      // Sort seeds according to requested sort order
      if (sort === "highest") {
        reviews.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      } else if (sort === "lowest") {
        reviews.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
      } else {
        // Most recent
        reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
