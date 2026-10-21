import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeRatingScale } from "@/lib/rating";

/**
 * GET /api/profile
 * Retrieves the current authenticated user's profile.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ profile: null, isMock: true });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ profile: null, error: "Not authenticated" });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ profile: null, error: error.message });
    }

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile
 * Updates the current user's profile in the profiles table (especially rating_scale).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Unauthorized: Supabase client unavailable" },
        { status: 401 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const {
      data: { user },
      error: authError,
    } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be signed in to update your profile" },
        { status: 401 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.rating_scale !== undefined) {
      updates.rating_scale = normalizeRatingScale(body.rating_scale);
    }
    if (body.display_name !== undefined) {
      updates.display_name = body.display_name;
    }
    if (body.bio !== undefined) {
      updates.bio = body.bio;
    }
    if (body.default_privacy !== undefined) {
      updates.default_privacy = body.default_privacy;
    }
    if (body.profile_visibility !== undefined) {
      updates.profile_visibility = body.profile_visibility === "private" ? "private" : "public";
    }
    if (body.theme !== undefined) {
      updates.theme = body.theme;
    }

    // Try upserting directly using user client first
    const { data: updatedProfile, error: upsertErr } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...updates,
      })
      .select()
      .maybeSingle();

    if (upsertErr) {
      console.warn("User client upsert error, trying admin client fallback:", upsertErr);
      const admin = createAdminClient();
      if (admin) {
        const { data: adminProfile, error: adminErr } = await admin
          .from("profiles")
          .upsert({
            id: user.id,
            ...updates,
          })
          .select()
          .maybeSingle();

        if (adminErr) {
          console.error("Admin client upsert error:", adminErr);
          return NextResponse.json({ error: adminErr.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, profile: adminProfile });
      }
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
