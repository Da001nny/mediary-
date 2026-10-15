import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ entries: [] });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", entries: [] },
        { status: 401 }
      );
    }

    const { data: entries, error } = await supabase
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
          community_rating_avg,
          type_specific
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching diary entries for user:", error);
      return NextResponse.json(
        { error: "Failed to fetch entries", entries: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({ entries: entries || [] });
  } catch (err: unknown) {
    console.error("Diary entries endpoint error:", err);
    return NextResponse.json(
      { error: "Failed to load entries", entries: [] },
      { status: 500 }
    );
  }
}
