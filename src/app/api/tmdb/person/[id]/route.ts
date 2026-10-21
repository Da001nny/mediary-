import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTMDBPerson } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
        { error: "Unauthorized: You must be signed in to view person details." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const trimmedId = (id || "").trim();
    const numericId = Number(trimmedId);

    if (!/^\d+$/.test(trimmedId) || !Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { error: "Person ID must be a positive integer." },
        { status: 400 }
      );
    }

    const { data, error, isMock } = await fetchTMDBPerson(numericId);

    if (error || !data) {
      return NextResponse.json(
        { error: error || "Person not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ person: data, isMock });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch TMDB person",
      },
      { status: 500 }
    );
  }
}
