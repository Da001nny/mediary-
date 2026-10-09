import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { headers } from "next/headers";

export interface AdminVerificationResult {
  isAdmin: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Verifies whether the currently signed-in user is an admin.
 * Follows strict rules:
 * - Compares user.id with ADMIN_USER_ID env var
 * - Uses supabase.auth.getUser() (not getSession())
 * - If ADMIN_USER_ID is missing or empty, denies everyone (isAdmin: false)
 */
export async function verifyAdminUser(): Promise<AdminVerificationResult> {
  const adminUserId = process.env.ADMIN_USER_ID?.trim();

  // If ADMIN_USER_ID is missing or empty, deny everyone rather than allowing everyone
  if (!adminUserId) {
    return {
      isAdmin: false,
      userId: null,
      error: "ADMIN_USER_ID is not configured on the server",
    };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return {
      isAdmin: false,
      userId: null,
      error: "Supabase client is not available",
    };
  }

  // Check for Authorization: Bearer <token> in headers if passed from client fetch
  let bearerToken: string | undefined;
  try {
    const headerList = await headers();
    const authHeader = headerList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      bearerToken = authHeader.substring(7).trim();
    }
  } catch {
    // headers() might throw in edge rendering scenarios
  }

  try {
    const {
      data: { user },
      error,
    } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (error || !user) {
      return {
        isAdmin: false,
        userId: null,
        error: error?.message || "Not authenticated",
      };
    }

    if (user.id !== adminUserId) {
      return {
        isAdmin: false,
        userId: user.id,
        error: "Forbidden: user does not match ADMIN_USER_ID",
      };
    }

    return {
      isAdmin: true,
      userId: user.id,
    };
  } catch (err: unknown) {
    return {
      isAdmin: false,
      userId: null,
      error: err instanceof Error ? err.message : "Failed to verify admin user",
    };
  }
}
