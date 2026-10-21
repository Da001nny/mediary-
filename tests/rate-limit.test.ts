import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../src/lib/rate-limit";

describe("checkRateLimit - fail open behavior", () => {
  test("returns true (fails open) when Supabase is not configured or in fallback mode", async () => {
    const result = await checkRateLimit("search:user-123", 30, 60);
    assert.equal(result, true);
  });

  test("handles empty or special character keys gracefully", async () => {
    const result = await checkRateLimit("dbsearch:127.0.0.1", 30, 60);
    assert.equal(result, true);
  });
});
