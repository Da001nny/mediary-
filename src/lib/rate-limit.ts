import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Checks if a request is within allowed rate limits using the database RPC function `check_rate_limit`.
 *
 * Calls createAdminClient().rpc("check_rate_limit", { p_key, p_limit, p_window_seconds }).
 * If the call errors or client is unavailable, allows the request (fails open) and logs the error.
 * Returns true if allowed, false if rate limit exceeded.
 */
export async function checkRateLimit(
  p_key: string,
  p_limit: number,
  p_window_seconds: number
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.rpc as any)("check_rate_limit", {
      p_key,
      p_limit,
      p_window_seconds,
    });

    if (error) {
      console.error("Rate limit check error:", error);
      return true;
    }

    return typeof data === "boolean" ? data : true;
  } catch (err) {
    console.error("Failed to check rate limit:", err);
    return true;
  }
}
