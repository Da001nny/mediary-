import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    // Authenticate with supabase.auth.getUser() and return 401 if no user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Never accept a user id from the request; all queries filter strictly by user.id

    // 1. Profile: display_name, bio, avatar_url, region, locale, rating_scale,
    //    theme, default_privacy, profile_visibility, joined_at, and session email
    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        display_name,
        bio,
        avatar_url,
        region,
        locale,
        rating_scale,
        theme,
        default_privacy,
        profile_visibility,
        joined_at
      `)
      .eq("id", user.id)
      .maybeSingle();

    const profileExport = {
      email: user.email ?? null,
      display_name: profile?.display_name ?? null,
      bio: profile?.bio ?? null,
      avatar_url: profile?.avatar_url ?? null,
      region: profile?.region ?? null,
      locale: profile?.locale ?? "en",
      rating_scale: profile?.rating_scale ?? "5-star",
      theme: profile?.theme ?? "system",
      default_privacy: profile?.default_privacy ?? "public",
      profile_visibility: profile?.profile_visibility ?? "public",
      joined_at: profile?.joined_at ?? null,
    };

    // 2. Entries joined to media (title, type, release year, external ids),
    //    with status, rating, review, spoiler flag, privacy, started_at, completed_at, created_at
    const { data: entriesRaw, error: entriesError } = await supabase
      .from("entries")
      .select(`
        id,
        status,
        rating,
        review,
        contains_spoilers,
        privacy,
        started_at,
        completed_at,
        created_at,
        media (
          title,
          type,
          release_date,
          external_ids
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (entriesError) {
      console.error("Account export entries error:", entriesError);
    }

    const entries = (entriesRaw || []).map((entry) => {
      const m = entry.media as unknown as {
        title?: string;
        type?: string;
        release_date?: string | null;
        external_ids?: Record<string, unknown> | null;
      } | null;

      let releaseYear: number | null = null;
      if (m?.release_date) {
        const parsed = new Date(m.release_date).getUTCFullYear();
        if (!isNaN(parsed)) releaseYear = parsed;
      }

      return {
        id: entry.id,
        media: {
          title: m?.title ?? "Untitled",
          type: m?.type ?? "movie",
          release_year: releaseYear,
          external_ids: m?.external_ids ?? {},
        },
        status: entry.status,
        rating: entry.rating,
        review: entry.review,
        contains_spoilers: entry.contains_spoilers ?? false,
        privacy: entry.privacy,
        started_at: entry.started_at,
        completed_at: entry.completed_at,
        created_at: entry.created_at,
      };
    });

    // 3. Lists with their items (media title, type, position, notes)
    const { data: listsRaw, error: listsError } = await supabase
      .from("lists")
      .select(`
        id,
        title:name,
        name,
        description,
        is_ranked,
        privacy,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (listsError) {
      console.error("Account export lists error:", listsError);
    }

    const listIds = (listsRaw || []).map((l) => l.id);
    const listItemsByListId: Record<
      string,
      Array<{
        position: number;
        notes: string | null;
        media: { title: string; type: string };
        added_at: string;
      }>
    > = {};

    if (listIds.length > 0) {
      const { data: listItemsRaw, error: listItemsError } = await supabase
        .from("list_items")
        .select(`
          id,
          list_id,
          position,
          notes,
          added_at,
          media (
            title,
            type
          )
        `)
        .in("list_id", listIds)
        .order("position", { ascending: true });

      if (listItemsError) {
        console.error("Account export list_items error:", listItemsError);
      }

      if (listItemsRaw) {
        for (const item of listItemsRaw) {
          if (!listItemsByListId[item.list_id]) {
            listItemsByListId[item.list_id] = [];
          }
          const m = item.media as unknown as { title?: string; type?: string } | null;
          listItemsByListId[item.list_id].push({
            position: item.position,
            notes: item.notes ?? null,
            media: {
              title: m?.title ?? "Untitled",
              type: m?.type ?? "movie",
            },
            added_at: item.added_at,
          });
        }
      }
    }

    const lists = (listsRaw || []).map((l) => ({
      id: l.id,
      title: l.name || l.title,
      description: l.description,
      is_ranked: l.is_ranked,
      privacy: l.privacy,
      created_at: l.created_at,
      items: listItemsByListId[l.id] || [],
    }));

    // 4. Comments the user wrote
    const { data: commentsRaw, error: commentsError } = await supabase
      .from("comments")
      .select(`
        id,
        entry_id,
        list_id,
        parent_id,
        body,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (commentsError) {
      console.error("Account export comments error:", commentsError);
    }

    const comments = (commentsRaw || []).map((c) => ({
      id: c.id,
      target_type: c.entry_id ? "entry" : "list",
      target_id: c.entry_id || c.list_id,
      parent_id: c.parent_id,
      body: c.body,
      created_at: c.created_at,
    }));

    // 5. Likes the user gave
    const { data: likesRaw, error: likesError } = await supabase
      .from("likes")
      .select(`
        id,
        entry_id,
        list_id,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (likesError) {
      console.error("Account export likes error:", likesError);
    }

    const likes = (likesRaw || []).map((l) => ({
      id: l.id,
      target_type: l.entry_id ? "entry" : "list",
      target_id: l.entry_id || l.list_id,
      created_at: l.created_at,
    }));

    // 6. Who the user follows and who follows them (display_name and id only)
    const { data: followingRaw } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const followingIds = (followingRaw || []).map((f) => f.following_id);
    let followingProfiles: Array<{ id: string; display_name: string | null }> = [];
    if (followingIds.length > 0) {
      const { data: safeProfiles } = await supabase
        .from("safe_profiles")
        .select("id, display_name")
        .in("id", followingIds);

      followingProfiles = (safeProfiles || []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
      }));
    }

    const { data: followersRaw } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id);

    const followerIds = (followersRaw || []).map((f) => f.follower_id);
    let followerProfiles: Array<{ id: string; display_name: string | null }> = [];
    if (followerIds.length > 0) {
      const { data: safeProfiles } = await supabase
        .from("safe_profiles")
        .select("id, display_name")
        .in("id", followerIds);

      followerProfiles = (safeProfiles || []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
      }));
    }

    const follows = {
      following: followingProfiles,
      followers: followerProfiles,
    };

    // 7. Shared years and import job summaries (source, status, counts, dates)
    const { data: sharedYearsRaw } = await supabase
      .from("shared_years")
      .select("year, created_at")
      .eq("user_id", user.id)
      .order("year", { ascending: false });

    const sharedYears = (sharedYearsRaw || []).map((s) => ({
      year: s.year,
      created_at: s.created_at,
    }));

    const { data: importJobsRaw } = await supabase
      .from("import_jobs")
      .select(`
        id,
        source,
        status,
        total,
        matched,
        already_logged,
        needs_review,
        failed,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const importJobs = (importJobsRaw || []).map((job) => ({
      id: job.id,
      source: job.source,
      status: job.status,
      counts: {
        total: job.total,
        matched: job.matched,
        already_logged: job.already_logged,
        needs_review: job.needs_review,
        failed: job.failed,
      },
      dates: {
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    }));

    // Assemble complete export payload
    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profileExport,
      entries,
      lists,
      comments,
      likes,
      follows,
      shared_years: sharedYears,
      import_jobs: importJobs,
    };

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `mediary-export-${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/account/export unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
