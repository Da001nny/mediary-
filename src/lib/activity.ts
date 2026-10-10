import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, PrivacyLevel, Json } from "@/types/database.types";

/**
 * Controlled list of media types returned by the feed READ query.
 * Storing rows works for all media types (movie, tv, game, book),
 * but the feed READ query returns only movie and TV items.
 * Enabling games and books later is a one-line change here.
 */
export const FEED_ALLOWED_MEDIA_TYPES: readonly string[] = ["movie", "tv"] as const;

export type ActivityType = "logged" | "reviewed" | "listed" | "followed";

export interface RecordEntryActivityParams {
  userId: string;
  entryId: string;
  privacy: PrivacyLevel;
  mediaId: string;
  mediaType: string;
  rating?: number | null;
  review?: string | null;
  containsSpoilers?: boolean;
  status?: string;
  createdAt?: string;
  client?: SupabaseClient<Database> | null;
}

export interface RecordListActivityParams {
  userId: string;
  listId: string;
  privacy: PrivacyLevel;
  title?: string;
  name?: string;
  description?: string | null;
  createdAt?: string;
  client?: SupabaseClient<Database> | null;
}

export interface RecordFollowActivityParams {
  followerId: string;
  followingId: string;
  client?: SupabaseClient<Database> | null;
}

export interface RemoveActivityParams {
  userId: string;
  refId: string;
  type?: ActivityType;
  client?: SupabaseClient<Database> | null;
}

export interface GenericRecordActivityParams {
  userId: string;
  type: ActivityType;
  refId: string;
  privacy: PrivacyLevel;
  mediaId?: string | null;
  mediaType?: string | null;
  data?: Record<string, unknown>;
  createdAt?: string;
  client?: SupabaseClient<Database> | null;
}

/**
 * Resolves a viable Supabase client:
 * Prefers the passed client (e.g. authenticated session client),
 * falling back to admin client or server client.
 */
async function resolveDbClient(client?: SupabaseClient<Database> | null): Promise<SupabaseClient<Database> | null> {
  if (client) return client;
  const admin = createAdminClient();
  if (admin) return admin as unknown as SupabaseClient<Database>;
  const serverClient = await createClient();
  return serverClient as unknown as SupabaseClient<Database>;
}

/**
 * Generic helper to record/upsert an activity item.
 * Enforces one row per (user_id, type, ref_id) without bumping created_at on conflict.
 */
export async function recordActivity(params: GenericRecordActivityParams): Promise<void> {
  try {
    // Only entries and lists with privacy public or friends create rows.
    // Private ones create none.
    if (params.privacy === "private") {
      await removeActivity({
        userId: params.userId,
        refId: params.refId,
        type: params.type,
        client: params.client,
      });
      return;
    }

    const db = await resolveDbClient(params.client);
    if (!db) return;

    const payload: Database["public"]["Tables"]["activity"]["Insert"] = {
      user_id: params.userId,
      type: params.type,
      ref_id: params.refId,
      privacy: params.privacy,
      media_id: params.mediaId || null,
      media_type: params.mediaType || null,
      data: (params.data || {}) as unknown as Json,
    };

    if (params.createdAt) {
      payload.created_at = params.createdAt;
    }

    // Upsert into activity respecting unique index (user_id, type, ref_id)
    // On conflict, update privacy, media_id, media_type, data without bumping created_at
    const { error } = await db
      .from("activity")
      .upsert(payload, {
        onConflict: "user_id,type,ref_id",
      });

    if (error) {
      console.error("Error in recordActivity upsert:", error);
    }
  } catch (err) {
    console.error("Unexpected error in recordActivity:", err);
  }
}

/**
 * Removes activity row(s) for a given user and ref_id.
 * If type is omitted, removes all activity types for that ref_id.
 */
export async function removeActivity(params: RemoveActivityParams): Promise<void> {
  try {
    const db = await resolveDbClient(params.client);
    if (!db) return;

    let query = db
      .from("activity")
      .delete()
      .eq("user_id", params.userId)
      .eq("ref_id", params.refId);

    if (params.type) {
      query = query.eq("type", params.type);
    }

    const { error } = await query;
    if (error) {
      console.error("Error in removeActivity:", error);
    }
  } catch (err) {
    console.error("Unexpected error in removeActivity:", err);
  }
}

/**
 * Server-side helper to record entry activities ('logged' and optionally 'reviewed').
 * Rules:
 * - Only public or friends create rows. Private ones delete existing rows.
 * - If an item switches between public and friends, row's privacy is updated.
 * - One row per (user_id, type, ref_id), does not bump created_at.
 * - A 'reviewed' row is created the first time an entry gets review text.
 */
export async function recordEntryActivity(params: RecordEntryActivityParams): Promise<void> {
  const { userId, entryId, privacy, mediaId, mediaType, rating, review, containsSpoilers, status, createdAt, client } = params;

  if (privacy === "private") {
    // Private entries create NO rows. Remove any prior activity.
    await removeActivity({ userId, refId: entryId, client });
    return;
  }

  const dataPayload: Record<string, unknown> = {
    rating: rating ?? null,
    review: review ? review.trim() : null,
    contains_spoilers: Boolean(containsSpoilers),
    status: status || "completed",
  };

  // 1. Record 'logged' activity
  await recordActivity({
    userId,
    type: "logged",
    refId: entryId,
    privacy,
    mediaId,
    mediaType,
    data: dataPayload,
    createdAt,
    client,
  });

  // 2. Check review text: A 'reviewed' row is created the first time an entry gets review text
  const trimmedReview = review ? review.trim() : "";
  if (trimmedReview.length > 0) {
    await recordActivity({
      userId,
      type: "reviewed",
      refId: entryId,
      privacy,
      mediaId,
      mediaType,
      data: dataPayload,
      createdAt,
      client,
    });
  } else {
    // If review was deleted/cleared, remove any existing 'reviewed' row
    await removeActivity({
      userId,
      refId: entryId,
      type: "reviewed",
      client,
    });
  }
}

/**
 * Server-side helper to record list activities ('listed').
 * Rules:
 * - Only public or friends create rows. Private ones delete existing rows.
 * - If an item switches between public and friends, row's privacy is updated.
 */
export async function recordListActivity(params: RecordListActivityParams): Promise<void> {
  const { userId, listId, privacy, title, name, description, createdAt, client } = params;

  if (privacy === "private") {
    await removeActivity({ userId, refId: listId, client });
    return;
  }

  const listTitle = (title || name || "").trim();

  await recordActivity({
    userId,
    type: "listed",
    refId: listId,
    privacy,
    data: {
      name: listTitle,
      description: description || null,
    },
    createdAt,
    client,
  });
}

/**
 * Server-side helper to record follow activities ('followed').
 * Rules:
 * - 'followed' rows are only created when the follower's profile_visibility is public.
 */
export async function recordFollowActivity(params: RecordFollowActivityParams): Promise<void> {
  try {
    const { followerId, followingId, client } = params;
    const db = await resolveDbClient(client);
    if (!db) return;

    // Check follower's profile_visibility
    const { data: followerProfile, error: profileErr } = await db
      .from("profiles")
      .select("profile_visibility")
      .eq("id", followerId)
      .maybeSingle();

    if (profileErr) {
      console.error("Error checking follower profile visibility:", profileErr);
    }

    // Only create 'followed' row when follower's profile_visibility is public
    if (followerProfile?.profile_visibility !== "public") {
      return;
    }

    await recordActivity({
      userId: followerId,
      type: "followed",
      refId: followingId,
      privacy: "public",
      data: {
        following_id: followingId,
      },
      client,
    });
  } catch (err) {
    console.error("Unexpected error in recordFollowActivity:", err);
  }
}
