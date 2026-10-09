import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ inProgress: [], recent: [] });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ inProgress: [], recent: [] });
    }

    // 1. Fetch user's in-progress entries (for "Continue" strip)
    const { data: inProgress, error: inProgErr } = await supabase
      .from("entries")
      .select(`
        id,
        user_id,
        media_id,
        status,
        rating,
        progress,
        review,
        contains_spoilers,
        privacy,
        started_at,
        completed_at,
        created_at,
        updated_at,
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
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (inProgErr) {
      console.error("Error fetching in-progress entries for home:", inProgErr);
    }

    // 2. Fetch user's most recently logged entries
    const { data: recent, error: recentErr } = await supabase
      .from("entries")
      .select(`
        id,
        user_id,
        media_id,
        status,
        rating,
        progress,
        review,
        contains_spoilers,
        privacy,
        started_at,
        completed_at,
        created_at,
        updated_at,
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
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(12);

    if (recentErr) {
      console.error("Error fetching recent entries for home:", recentErr);
    }

    return NextResponse.json({
      inProgress: inProgress || [],
      recent: recent || [],
    });
  } catch (err: unknown) {
    console.error("Home entries endpoint error:", err);
    return NextResponse.json(
      { inProgress: [], recent: [], error: "Failed to load home entries" },
      { status: 500 }
    );
  }
}
