import { NextRequest, NextResponse } from "next/server";
import { fetchTMDBPerson } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error, isMock } = await fetchTMDBPerson(id);

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
