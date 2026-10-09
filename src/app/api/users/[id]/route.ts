import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface PublicUserStats {
  titlesLogged: number;
  moviesLogged: number;
  tvLogged: number;
  topGenres: { genre: string; count: number }[];
  averageRating: number | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    let currentUserId: string | null = null;
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUserId = user?.id || null;
    }

    const db = admin || supabase;
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // 1. Fetch profile
    const { data: profile, error: pErr } = await db
      .from("profiles")
      .select("id, display_name, bio, avatar_url, region, locale, rating_scale, theme, default_privacy, profile_visibility, joined_at")
      .eq("id", targetUserId)
      .single();

    if (pErr || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOwner = Boolean(currentUserId && currentUserId === targetUserId);
    const profileVisibility = profile.profile_visibility || (profile.default_privacy === "private" ? "private" : "public");
    const isPrivate = profileVisibility === "private" && !isOwner;

    // 2. Fetch follower & following status
    // Owners must always see their full lists and true counts (using admin client if available)
    const countDb = isOwner && admin ? admin : db;
    const [followersRes, followingRes, isFollowingRes, targetFollowsViewerRes] = await Promise.all([
      // Only fetch counts if owner or profile is public
      !isPrivate
        ? countDb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetUserId)
        : Promise.resolve({ count: 0 }),
      !isPrivate
        ? countDb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetUserId)
        : Promise.resolve({ count: 0 }),
      currentUserId && currentUserId !== targetUserId
        ? db
            .from("follows")
            .select("follower_id")
            .eq("follower_id", currentUserId)
            .eq("following_id", targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      currentUserId && currentUserId !== targetUserId
        ? db
            .from("follows")
            .select("follower_id")
            .eq("follower_id", targetUserId)
            .eq("following_id", currentUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const isFollowing = Boolean(isFollowingRes?.data);
    const targetFollowsViewer = Boolean(targetFollowsViewerRes?.data);
    const isMutualFriend = isFollowing && targetFollowsViewer;

    // If profile is private and viewer is not owner:
    // Display name and avatar are shown, but bio, stats, logs, followers/following are hidden
    if (isPrivate) {
      return NextResponse.json({
        profile: {
          id: profile.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: null, // Hidden for private profiles
          default_privacy: profile.default_privacy,
          profile_visibility: "private",
          joined_at: profile.joined_at,
        },
        followersCount: 0,
        followingCount: 0,
        isFollowing,
        isMutualFriend: false,
        isPrivate: true,
        stats: null,
        recentLogs: [],
      });
    }

    const followersCount = followersRes.count || 0;
    const followingCount = followingRes.count || 0;

    // 3. Query entries for this user:
    // - Public logs are visible to everyone and used for public stats
    // - If viewer is a mutual friend, they can also see 'friends' logs
    // - If viewer is owner, they can see all logs
    let entriesQuery = db
      .from("entries")
      .select(`
        id,
        user_id,
        media_id,
        status,
        rating,
        review,
        contains_spoilers,
        privacy,
        started_at,
        completed_at,
        created_at,
        media (
          id,
          type,
          title,
          cover_url,
          release_date,
          genres,
          community_rating_avg
        )
      `)
      .eq("user_id", targetUserId);

    if (isOwner) {
      // Owner sees all their logs
    } else if (isMutualFriend) {
      // Mutual friends see public + friends logs
      entriesQuery = entriesQuery.in("privacy", ["public", "friends"]);
    } else {
      // General public sees only public logs
      entriesQuery = entriesQuery.eq("privacy", "public");
    }

    const { data: entries, error: eErr } = await entriesQuery.order("created_at", { ascending: false });

    if (eErr) {
      console.error("Error fetching public entries:", eErr);
    }

    const publicEntries = entries || [];

    // Calculate stats
    let moviesCount = 0;
    let tvCount = 0;
    let totalRatings = 0;
    let ratingSum = 0;
    const genreCounts: Record<string, number> = {};

    for (const entry of publicEntries) {
      const media = entry.media as unknown as {
        type?: string;
        genres?: string[];
      } | null;

      if (media?.type === "movie") moviesCount++;
      if (media?.type === "tv") tvCount++;

      if (typeof entry.rating === "number" && entry.rating > 0) {
        totalRatings++;
        ratingSum += entry.rating;
      }

      if (Array.isArray(media?.genres)) {
        for (const g of media.genres) {
          if (g && typeof g === "string") {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          }
        }
      }
    }

    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const stats: PublicUserStats = {
      titlesLogged: publicEntries.length,
      moviesLogged: moviesCount,
      tvLogged: tvCount,
      topGenres,
      averageRating:
        totalRatings > 0 ? Math.round((ratingSum / totalRatings) * 10) / 10 : null,
    };

    return NextResponse.json({
      profile: {
        ...profile,
        profile_visibility: profileVisibility,
      },
      followersCount,
      followingCount,
      isFollowing,
      isMutualFriend,
      isPrivate: false,
      stats,
      recentLogs: publicEntries.slice(0, 24),
    });
  } catch (err) {
    console.error("Public profile API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
