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
      .select("id, display_name, bio, avatar_url, region, locale, rating_scale, theme, default_privacy, joined_at")
      .eq("id", targetUserId)
      .single();

    if (pErr || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Fetch follower & following counts
    const [followersRes, followingRes, isFollowingRes] = await Promise.all([
      db
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId),
      db
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId),
      currentUserId && currentUserId !== targetUserId
        ? db
            .from("follows")
            .select("follower_id")
            .eq("follower_id", currentUserId)
            .eq("following_id", targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const followersCount = followersRes.count || 0;
    const followingCount = followingRes.count || 0;
    const isFollowing = Boolean(isFollowingRes?.data);

    const isOwner = currentUserId === targetUserId;
    const isPrivate = profile.default_privacy === "private" && !isOwner;

    // If profile is private and viewer is not owner, return minimal profile only
    if (isPrivate) {
      return NextResponse.json({
        profile: {
          id: profile.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          default_privacy: "private",
          joined_at: profile.joined_at,
        },
        followersCount,
        followingCount,
        isFollowing,
        isPrivate: true,
        stats: null,
        recentLogs: [],
      });
    }

    // 3. Query public entries for this user (with joined media)
    const { data: entries, error: eErr } = await db
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
      .eq("user_id", targetUserId)
      .eq("privacy", "public")
      .order("created_at", { ascending: false });

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
      profile,
      followersCount,
      followingCount,
      isFollowing,
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
