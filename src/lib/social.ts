/**
 * Social features configuration, rate limiting, and helpers for likes and comments.
 */

/**
 * Media types permitted for social interaction (likes & comments on entries).
 * Movie and TV entries only for now.
 * Enabling games and books later is a one-line change here.
 */
export const SOCIAL_ALLOWED_MEDIA_TYPES: readonly string[] = ["movie", "tv"] as const;

/**
 * In-memory sliding window rate limiter for comment creation.
 * Enforces max 10 comments per minute per user.
 */
const commentTimestampsByUser = new Map<string, number[]>();
const COMMENT_RATE_LIMIT_MAX = 10;
const COMMENT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export function checkCommentRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const existing = commentTimestampsByUser.get(userId) || [];
  const inWindow = existing.filter((timestamp) => now - timestamp < COMMENT_RATE_LIMIT_WINDOW_MS);

  if (inWindow.length >= COMMENT_RATE_LIMIT_MAX) {
    const oldestInWindow = inWindow[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestInWindow + COMMENT_RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  inWindow.push(now);
  commentTimestampsByUser.set(userId, inWindow);
  return { allowed: true };
}

export interface CommentAuthor {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface CommentWithReplies {
  id: string;
  user_id: string;
  entry_id: string | null;
  list_id: string | null;
  parent_id: string | null;
  body: string;
  created_at: string;
  author: CommentAuthor;
  replies?: CommentWithReplies[];
}
