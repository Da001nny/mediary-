import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }

    // 1. Authenticate with supabase.auth.getUser() on normal client; return 401 if no user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The only id ever used is the id from that session; never read a user id from request
    const sessionUserId = user.id;
    const sessionEmail = user.email;

    // Require JSON body { "confirm": "<email>" }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const payload = body as { confirm?: unknown };
    const confirmEmail =
      typeof payload?.confirm === "string" ? payload.confirm.trim() : "";

    if (
      !sessionEmail ||
      !confirmEmail ||
      confirmEmail.toLowerCase() !== sessionEmail.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Confirmation email does not match your account email" },
        { status: 400 }
      );
    }

    // 2. Delete user with admin client:
    // Existing foreign keys cascade from auth.users to dependent tables, do not delete by hand
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Admin client not configured" },
        { status: 500 }
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      sessionUserId
    );

    if (deleteError) {
      console.error("Account deleteUser admin error:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete user" },
        { status: 500 }
      );
    }

    // Sign out on normal client to invalidate current session
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("POST /api/account/delete unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
