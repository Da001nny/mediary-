import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import { fetchTMDBDetails, TMDB_IMAGE_BASE_W500, TMDB_IMAGE_BASE_ORIGINAL } from "@/lib/tmdb";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import {
  fetchGoogleBookDetails,
  bookToMediaPayload,
  formatBookCoverUrl,
} from "@/lib/google-books";
import type { MediaItem, Json, PrivacyLevel, Tables } from "@/types/database.types";
import type { ParsedImportItem } from "@/lib/import-parser";

export class UpstreamQuotaError extends Error {
  constructor(message = "Quota limit reached on upstream provider") {
    super(message);
    this.name = "UpstreamQuotaError";
  }
}

export interface CandidateItem {
  tmdb_id?: number;
  google_books_id?: string;
  rawg_id?: number;
  type?: "movie" | "tv" | "game" | "book";
  media_type?: string;
  id?: number | string;
  title: string;
  year?: string | number | null;
  author?: string | null;
  poster_url?: string | null;
  cover_url?: string | null;
  overview?: string | null;
  description?: string | null;
}

export interface MatchResult {
  status: "matched" | "already_logged" | "needs_review" | "failed";
  media_id?: string;
  candidates?: CandidateItem[];
  error?: string;
}

// In-process cache so repeated lookups cost only 1 upstream request
const catalogLookupCache = new Map<string, MatchResult>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes titles before comparing:
 * - lowercase
 * - strip accents (diacritics)
 * - strip punctuation
 * - ignore a leading "the"
 * - collapse whitespace
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  let s = rawTitle.toLowerCase();
  // Strip accents / diacritics via Unicode NFD
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Strip quotes and apostrophes without space so "it's" becomes "its"
  s = s.replace(/['’`"]/g, "");
  // Strip other punctuation by replacing with space
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // Ignore a leading "the"
  if (s.startsWith("the ")) {
    s = s.slice(4).trim();
  }
  return s;
}

/**
 * Normalizes an author string for comparison.
 */
export function normalizeAuthor(author: string): string {
  if (!author) return "";
  let s = author.toLowerCase();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Checks if candidate's first author matches the imported item's author.
 */
export function isFirstAuthorMatch(authorA?: string | null, authorB?: string | null): boolean {
  if (!authorA || !authorB) return false;
  const firstA = authorA.split(/[,;&]/)[0];
  const firstB = authorB.split(/[,;&]/)[0];
  const normA = normalizeAuthor(firstA);
  const normB = normalizeAuthor(firstB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Compare last name tokens
  const partsA = normA.split(" ").filter(Boolean);
  const partsB = normB.split(" ").filter(Boolean);
  const lastA = partsA[partsA.length - 1];
  const lastB = partsB[partsB.length - 1];
  if (lastA && lastB && lastA.length >= 2 && lastA === lastB) {
    return true;
  }
  return false;
}

/**
 * Searches the local database media catalog for an existing movie, TV series, or book.
 * Strictly requires matching normalized title AND year for film/TV, and ISBN or title+author for books.
 */
export async function findExistingMedia(
  item: ParsedImportItem
): Promise<MediaItem | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const normalizedTargetTitle = normalizeTitle(item.title);
  if (!normalizedTargetTitle) return null;

  if (item.source === "letterboxd") {
    // 1. Search movies and TV in local catalog
    const { data: localMatches } = await admin
      .from("media")
      .select("*")
      .in("type", ["movie", "tv"])
      .ilike("title", `%${item.title.trim().slice(0, 30)}%`)
      .limit(20);

    if (localMatches && localMatches.length > 0) {
      // Must match normalized title AND year (never auto-match on title alone when year does not match)
      const matchingItems = localMatches.filter((m) => {
        if (normalizeTitle(m.title) !== normalizedTargetTitle) return false;
        if (item.year == null) return false; // Never auto-match when year is absent or doesn't match
        const mYear = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null;
        return mYear === item.year;
      });

      if (matchingItems.length === 1) {
        return matchingItems[0] as unknown as MediaItem;
      }
    }
  } else if (item.source === "goodreads") {
    // 1. Search books by ISBN-13
    if (item.isbn13) {
      const { data: isbn13Matches } = await admin
        .from("media")
        .select("*")
        .eq("type", "book")
        .filter("external_ids->>isbn13", "eq", item.isbn13)
        .limit(1);

      if (isbn13Matches && isbn13Matches.length > 0) {
        return isbn13Matches[0] as unknown as MediaItem;
      }
    }

    // 2. Search books by ISBN-10
    if (item.isbn10) {
      const { data: isbn10Matches } = await admin
        .from("media")
        .select("*")
        .eq("type", "book")
        .filter("external_ids->>isbn10", "eq", item.isbn10)
        .limit(1);

      if (isbn10Matches && isbn10Matches.length > 0) {
        return isbn10Matches[0] as unknown as MediaItem;
      }
    }

    // 3. Search books by exact normalized title plus matching first author
    const { data: titleMatches } = await admin
      .from("media")
      .select("*")
      .eq("type", "book")
      .ilike("title", `%${item.title.trim().slice(0, 30)}%`)
      .limit(20);

    if (titleMatches && titleMatches.length > 0) {
      const matchingBooks = titleMatches.filter((m) => {
        if (normalizeTitle(m.title) !== normalizedTargetTitle) return false;
        const typeSpec = (m.type_specific as Record<string, unknown>) || {};
        const bookAuthor = String(typeSpec.author || "");
        return isFirstAuthorMatch(item.author, bookAuthor);
      });

      if (matchingBooks.length === 1) {
        return matchingBooks[0] as unknown as MediaItem;
      }
    }
  }

  return null;
}

/**
 * Syncs a TMDB Movie ID to public.media and Algolia.
 */
export async function syncTMDBMovieToMedia(tmdbId: number): Promise<string> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Database admin client unavailable");
  }

  // Check if media already exists
  const { data: existing } = await admin
    .from("media")
    .select("id")
    .filter("external_ids->>tmdb_id", "eq", String(tmdbId))
    .eq("type", "movie")
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // Fetch from TMDB (without mock fallback)
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const { data: details, error: tmdbErr, isMock } = await fetchTMDBDetails(tmdbId, "movie");
  if (tmdbErr || !details || isMock || (details.raw_data as { mock?: boolean })?.mock) {
    throw new Error(tmdbErr || "Cannot sync mock movie data into public.media");
  }

  const genreNames = Array.isArray(details.genres)
    ? details.genres.map((g) => (typeof g === "string" ? g : g.name))
    : [];

  const payload = {
    type: "movie" as const,
    title: details.title,
    cover_url: details.poster_path ? `${TMDB_IMAGE_BASE_W500}${details.poster_path}` : null,
    release_date: details.release_date || null,
    genres: genreNames,
    synopsis: details.overview || null,
    type_specific: {
      runtime: details.runtime,
      tagline: details.tagline,
      original_title: details.original_title,
      status: details.status,
      backdrop_url: details.backdrop_path
        ? `${TMDB_IMAGE_BASE_ORIGINAL}${details.backdrop_path}`
        : null,
      cast: details.cast,
      crew: details.crew,
    } as unknown as Json,
    external_ids: {
      tmdb_id: details.tmdb_id,
      imdb_id: details.imdb_id,
    } as unknown as Json,
    watch_providers: details.watch_providers as unknown as Json,
    localized_fields: {
      original_language: details.original_language,
      spoken_languages: details.spoken_languages,
      production_companies: details.production_companies,
    } as unknown as Json,
    community_rating_avg: details.vote_average || null,
    community_rating_count: details.vote_count || 0,
    last_synced_at: new Date().toISOString(),
  };

  const { data: upserted, error: dbErr } = await admin
    .from("media")
    .insert(payload)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") {
      const { data: existingOnConflict } = await admin
        .from("media")
        .select("id")
        .filter("external_ids->>tmdb_id", "eq", String(tmdbId))
        .eq("type", "movie")
        .maybeSingle();

      if (existingOnConflict?.id) {
        return existingOnConflict.id;
      }
    }
    throw new Error(dbErr.message || "Failed to persist movie to database");
  }

  if (!upserted) {
    throw new Error("Failed to persist movie to database");
  }

  // Index in Algolia
  try {
    await indexMediaItem(upserted as unknown as MediaItem);
  } catch (algoliaErr) {
    console.warn("Algolia indexing skipped for imported movie:", algoliaErr);
  }

  return upserted.id;
}

/**
 * Syncs a Google Book Volume ID to public.media and Algolia.
 */
export async function syncGoogleBookToMedia(googleBooksId: string): Promise<string> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Database admin client unavailable");
  }

  const cleanId = googleBooksId.replace(/^(book-|gb-)/i, "");

  // Check if media already exists
  const { data: existing } = await admin
    .from("media")
    .select("id")
    .filter("external_ids->>google_books_id", "eq", cleanId)
    .eq("type", "book")
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_BOOKS_API_KEY is not configured");
  }

  const { data: details, error: gbErr, isMock } = await fetchGoogleBookDetails(cleanId);
  if (gbErr || !details || isMock) {
    throw new Error(gbErr || "Cannot sync mock book data into public.media");
  }

  const payload = bookToMediaPayload(details);

  const { data: inserted, error: dbErr } = await admin
    .from("media")
    .insert(payload)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") {
      const { data: existingOnConflict } = await admin
        .from("media")
        .select("id")
        .filter("external_ids->>google_books_id", "eq", cleanId)
        .eq("type", "book")
        .maybeSingle();

      if (existingOnConflict?.id) {
        return existingOnConflict.id;
      }
    }
    throw new Error(dbErr.message || "Failed to persist book to database");
  }

  if (!inserted) {
    throw new Error("Failed to persist book to database");
  }

  // Index in Algolia
  try {
    await indexMediaItem(inserted as unknown as MediaItem);
  } catch (algoliaErr) {
    console.warn("Algolia indexing skipped for imported book:", algoliaErr);
  }

  return inserted.id;
}

/**
 * Syncs a TMDB TV Series ID to public.media and Algolia.
 */
export async function syncTMDBTVToMedia(tmdbId: number): Promise<string> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Database admin client unavailable");
  }

  // Check if media already exists
  const { data: existing } = await admin
    .from("media")
    .select("id")
    .filter("external_ids->>tmdb_id", "eq", String(tmdbId))
    .eq("type", "tv")
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // Fetch from TMDB
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const { data: details, error: tmdbErr, isMock } = await fetchTMDBDetails(tmdbId, "tv");
  if (tmdbErr || !details || isMock || (details.raw_data as { mock?: boolean })?.mock) {
    throw new Error(tmdbErr || "Cannot sync mock TV series data into public.media");
  }

  const genreNames = Array.isArray(details.genres)
    ? details.genres.map((g) => (typeof g === "string" ? g : g.name)).filter(Boolean)
    : [];

  const payload = {
    type: "tv" as const,
    title: details.title,
    cover_url: details.poster_path
      ? `${TMDB_IMAGE_BASE_W500}${details.poster_path}`
      : (details.poster_url || null),
    release_date: details.release_date || null,
    genres: genreNames,
    synopsis: details.overview || null,
    type_specific: {
      runtime: details.runtime,
      tagline: details.tagline,
      original_title: details.original_title,
      status: details.status,
      backdrop_url: details.backdrop_path
        ? `${TMDB_IMAGE_BASE_ORIGINAL}${details.backdrop_path}`
        : (details.backdrop_url || null),
      number_of_seasons: details.number_of_seasons,
      number_of_episodes: details.number_of_episodes,
      cast: details.cast,
      crew: details.crew,
    } as unknown as Json,
    external_ids: {
      tmdb_id: details.tmdb_id,
      imdb_id: details.imdb_id,
    } as unknown as Json,
    watch_providers: details.watch_providers as unknown as Json,
    localized_fields: {
      original_language: details.original_language,
      spoken_languages: details.spoken_languages,
      production_companies: details.production_companies,
    } as unknown as Json,
    community_rating_avg: details.vote_average || null,
    community_rating_count: details.vote_count || 0,
    last_synced_at: new Date().toISOString(),
  };

  const { data: upserted, error: dbErr } = await admin
    .from("media")
    .insert(payload)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") {
      const { data: existingOnConflict } = await admin
        .from("media")
        .select("id")
        .filter("external_ids->>tmdb_id", "eq", String(tmdbId))
        .eq("type", "tv")
        .maybeSingle();

      if (existingOnConflict?.id) {
        return existingOnConflict.id;
      }
    }
    throw new Error(dbErr.message || "Failed to persist TV series to database");
  }

  if (!upserted) {
    throw new Error("Failed to persist TV series to database");
  }

  // Index in Algolia
  try {
    await indexMediaItem(upserted as unknown as MediaItem);
  } catch (algoliaErr) {
    console.warn("Algolia indexing skipped for imported TV series:", algoliaErr);
  }

  return upserted.id;
}

/**
 * Syncs a RAWG Game ID to public.media and Algolia.
 */
export async function syncRAWGGameToMedia(rawgId: number | string): Promise<string> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Database admin client unavailable");
  }

  const numId = Number(rawgId);
  const cleanId =
    !isNaN(numId) && numId > 0
      ? String(numId)
      : String(rawgId).replace(/^(game-|rawg-)/i, "");

  // Check if media already exists
  const { data: existing } = await admin
    .from("media")
    .select("id")
    .filter("external_ids->>rawg_id", "eq", cleanId)
    .eq("type", "game")
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const apiKey = process.env.RAWG_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RAWG_API_KEY is not configured");
  }

  const { data: details, error: rawgErr, isMock } = await fetchRAWGGameDetails(cleanId);
  if (rawgErr || !details || isMock) {
    throw new Error(rawgErr || "Cannot sync mock game data into public.media");
  }

  const payload = rawgGameToMediaPayload(details);

  const { data: inserted, error: dbErr } = await admin
    .from("media")
    .insert(payload)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505") {
      const { data: existingOnConflict } = await admin
        .from("media")
        .select("id")
        .filter("external_ids->>rawg_id", "eq", cleanId)
        .eq("type", "game")
        .maybeSingle();

      if (existingOnConflict?.id) {
        return existingOnConflict.id;
      }
    }
    throw new Error(dbErr.message || "Failed to persist game to database");
  }

  if (!inserted) {
    throw new Error("Failed to persist game to database");
  }

  // Index in Algolia
  try {
    await indexMediaItem(inserted as unknown as MediaItem);
  } catch (algoliaErr) {
    console.warn("Algolia indexing skipped for imported game:", algoliaErr);
  }

  return inserted.id;
}

/**
 * Searches TMDB for movie and TV candidates without mock fallback using multi-search.
 */
export async function searchTMDBReal(
  query: string
): Promise<{
  results: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string;
    overview?: string;
  }>;
}> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured in server environment");
  }

  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return { results: [] };
  }

  const url = new URL("https://api.themoviedb.org/3/search/multi");
  url.searchParams.set("query", trimmedQuery);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey.startsWith("eyJ")) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  const res = await fetch(url.toString(), { headers });

  if (res.status === 429) {
    throw new UpstreamQuotaError("TMDB rate limit reached (HTTP 429)");
  }

  if (!res.ok) {
    throw new Error(`TMDB search returned status ${res.status}`);
  }

  const data = await res.json();
  const rawResults = Array.isArray(data.results) ? data.results : [];
  return { results: rawResults };
}

/**
 * Searches Google Books for volume candidates without mock fallback.
 */
export async function searchGoogleBooksReal(
  query: string
): Promise<{ items: Array<{ id: string; volumeInfo: Record<string, unknown> }> }> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("printType", "books");

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });

  if (res.status === 429) {
    throw new UpstreamQuotaError("Google Books rate limit reached (HTTP 429)");
  }

  if (!res.ok) {
    throw new Error(`Google Books API returned status ${res.status}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return { items };
}

/**
 * Matches an item against the existing catalog, or queries external sources.
 * Adheres to strict auto-match rules:
 * 1. Normalized titles (lowercase, stripped accents/punctuation, ignored leading "the", collapsed whitespace)
 * 2. Movies & TV: exactly one candidate matching normalized title AND year (first_air_date for TV); otherwise needs_review
 * 3. Books: ISBN-13 or ISBN-10 first; otherwise exact normalized title plus matching first author; otherwise needs_review
 * 4. Never auto-matches on title alone when year does not match
 * 5. Zero candidates becomes status "failed" with error "No match found"
 */
export async function matchImportItem(
  item: ParsedImportItem
): Promise<MatchResult> {
  const normTitle = normalizeTitle(item.title);
  const cacheKey =
    item.source === "letterboxd"
      ? `movie:${normTitle}:${item.year || ""}`
      : `book:${item.isbn13 || item.isbn10 || normTitle + ":" + (item.author || "")}`;

  const cached = catalogLookupCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Check existing catalog first
  try {
    const existing = await findExistingMedia(item);
    if (existing?.id) {
      const result: MatchResult = { status: "matched", media_id: existing.id };
      catalogLookupCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn("Catalog lookup error:", err);
  }

  // 2. Query External APIs with slight throttle
  await sleep(150);

  if (item.source === "letterboxd") {
    try {
      const { results: rawResults } = await searchTMDBReal(item.title);
      // Filter out people (cast/crew) from multi-search
      let candidateResults = (rawResults || []).filter(
        (r) => r.media_type !== "person"
      );

      // Fallback search with normalized title if query had punctuation and returned 0 results
      if (candidateResults.length === 0 && normTitle && normTitle !== item.title.toLowerCase().trim()) {
        const fallback = await searchTMDBReal(normTitle);
        candidateResults = (fallback.results || []).filter(
          (r) => r.media_type !== "person"
        );
      }

      // Rule 5: A row with zero candidates becomes status "failed" with the error "No match found"
      // instead of needs_review, so the review list only contains rows a person can actually resolve.
      if (candidateResults.length === 0) {
        const result: MatchResult = {
          status: "failed",
          error: "No match found",
        };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // Rule 2 & 4: Movies and TV: mark the row matched automatically when exactly one
      // candidate has the same normalized title AND a release year equal to the
      // row's year (first_air_date year for TV). Never auto-match on title alone when the year does not match.
      const satisfyingCandidates = candidateResults.filter((r) => {
        const candTitle = r.title || r.name || "";
        if (normalizeTitle(candTitle) !== normTitle) {
          return false;
        }

        // Must have year matching item.year (if item.year is null or doesn't match, cannot auto-match)
        if (item.year == null) {
          return false;
        }

        const isTv = r.media_type === "tv" || (!r.title && Boolean(r.name));
        const dateStr = isTv ? r.first_air_date : r.release_date;
        const candYear = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
        return candYear === item.year;
      });

      // Mark matched automatically when exactly one candidate satisfies both
      if (satisfyingCandidates.length === 1) {
        const matched = satisfyingCandidates[0];
        const isTv = matched.media_type === "tv" || (!matched.title && Boolean(matched.name));
        const mediaId = isTv
          ? await syncTMDBTVToMedia(matched.id)
          : await syncTMDBMovieToMedia(matched.id);

        const result: MatchResult = { status: "matched", media_id: mediaId };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // If zero or two-plus candidates satisfy both, send it to needs_review with its candidates (up to 5)
      const candidates: CandidateItem[] = candidateResults.slice(0, 5).map((r) => {
        const isTv = r.media_type === "tv" || (!r.title && Boolean(r.name));
        const dateStr = isTv ? r.first_air_date : r.release_date;
        const year = dateStr ? dateStr.slice(0, 4) : null;

        return {
          tmdb_id: r.id,
          type: isTv ? "tv" : "movie",
          media_type: isTv ? "tv" : "movie",
          title: r.title || r.name || "Unknown",
          year,
          poster_url: r.poster_path
            ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
            : null,
          overview: r.overview ? r.overview.slice(0, 250) : null,
        };
      });

      const result: MatchResult = {
        status: "needs_review",
        candidates,
      };
      catalogLookupCache.set(cacheKey, result);
      return result;
    } catch (err: unknown) {
      if (err instanceof UpstreamQuotaError) throw err;
      const result: MatchResult = {
        status: "failed",
        error: err instanceof Error ? err.message : "Movie search failed",
      };
      catalogLookupCache.set(cacheKey, result);
      return result;
    }
  } else {
    // Goodreads Books matching
    try {
      // Step A: Search via ISBN-13
      if (item.isbn13) {
        const { items } = await searchGoogleBooksReal(`isbn:${item.isbn13}`);
        if (items && items.length > 0) {
          const mediaId = await syncGoogleBookToMedia(items[0].id);
          const result: MatchResult = { status: "matched", media_id: mediaId };
          catalogLookupCache.set(cacheKey, result);
          return result;
        }
      }

      // Step B: Search via ISBN-10
      if (item.isbn10) {
        const { items } = await searchGoogleBooksReal(`isbn:${item.isbn10}`);
        if (items && items.length > 0) {
          const mediaId = await syncGoogleBookToMedia(items[0].id);
          const result: MatchResult = { status: "matched", media_id: mediaId };
          catalogLookupCache.set(cacheKey, result);
          return result;
        }
      }

      // Step C: Search via Title + Author
      let q = `intitle:${item.title.trim()}`;
      if (item.author) {
        q += ` inauthor:${item.author.trim()}`;
      }

      let { items } = await searchGoogleBooksReal(q);

      // If no items with author qualifier, try searching title alone to get candidate volumes
      if (!items || items.length === 0) {
        const fallback = await searchGoogleBooksReal(item.title.trim());
        items = fallback.items || [];
      }

      // Rule 5: A row with zero candidates becomes status "failed" with the error "No match found"
      if (!items || items.length === 0) {
        const result: MatchResult = {
          status: "failed",
          error: "No match found",
        };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // Rule 3: Otherwise on exact normalized title plus matching first author. Otherwise needs_review.
      const satisfyingCandidates = items.filter((b) => {
        const v = (b.volumeInfo || {}) as Record<string, unknown>;
        const candTitle = String(v.title || "");
        if (normalizeTitle(candTitle) !== normTitle) {
          return false;
        }

        const authors = Array.isArray(v.authors) ? v.authors : [];
        const candFirstAuthor = authors[0] ? String(authors[0]) : null;
        return isFirstAuthorMatch(item.author, candFirstAuthor);
      });

      // If exactly 1 candidate matches exact normalized title + matching first author
      if (satisfyingCandidates.length === 1) {
        const mediaId = await syncGoogleBookToMedia(satisfyingCandidates[0].id);
        const result: MatchResult = { status: "matched", media_id: mediaId };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // Otherwise needs_review with up to 5 candidates
      const candidates: CandidateItem[] = items.slice(0, 5).map((b) => {
        const v = (b.volumeInfo || {}) as Record<string, unknown>;
        const authors = Array.isArray(v.authors) ? v.authors : [];
        const imageLinks = (v.imageLinks as Record<string, string>) || {};
        return {
          google_books_id: b.id,
          type: "book",
          media_type: "book",
          title: String(v.title || "Unknown"),
          author: authors[0] ? String(authors[0]) : null,
          year: v.publishedDate ? String(v.publishedDate).slice(0, 4) : null,
          cover_url: formatBookCoverUrl(imageLinks.thumbnail || imageLinks.smallThumbnail),
          description: v.description ? String(v.description).slice(0, 250) : null,
        };
      });

      const result: MatchResult = {
        status: "needs_review",
        candidates,
      };
      catalogLookupCache.set(cacheKey, result);
      return result;
    } catch (err: unknown) {
      if (err instanceof UpstreamQuotaError) throw err;
      const result: MatchResult = {
        status: "failed",
        error: err instanceof Error ? err.message : "Book search failed",
      };
      catalogLookupCache.set(cacheKey, result);
      return result;
    }
  }
}

/**
 * Resolves the chosen privacy level based on import options and user profile default.
 */
export async function resolveImportPrivacy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  chosenOption?: string
): Promise<PrivacyLevel> {
  if (chosenOption === "public" || chosenOption === "friends" || chosenOption === "private") {
    return chosenOption;
  }

  // Default option selected: query user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_privacy")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.default_privacy === "public" || profile?.default_privacy === "friends") {
    return profile.default_privacy;
  }
  return "private";
}

export interface ProcessImportBatchResult {
  success: boolean;
  status: "pending" | "processing" | "completed" | "paused" | "failed";
  processedBatchSize: number;
  remaining: number;
  job: Tables<"import_jobs"> | null;
  quotaHit?: boolean;
  message?: string;
  error?: string;
}

/**
 * Shared server-side batch processor for an import job.
 * Always runs with admin credentials, loads the job, and strictly uses
 * job.user_id as the owner of every created diary entry.
 * Recovers stuck items (> 2 min in processing) and handles 23505 deduplication.
 */
export async function processImportBatch(jobId: string): Promise<ProcessImportBatchResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      success: false,
      status: "failed",
      processedBatchSize: 0,
      remaining: 0,
      job: null,
      error: "Database admin client unavailable",
    };
  }

  // 1. Load job
  const { data: job, error: jobErr } = await admin
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return {
      success: false,
      status: "failed",
      processedBatchSize: 0,
      remaining: 0,
      job: null,
      error: "Import job not found",
    };
  }

  // If job was already marked completed, return current status
  if (job.status === "completed") {
    return {
      success: true,
      status: "completed",
      processedBatchSize: 0,
      remaining: 0,
      job,
    };
  }

  // Resolve user's chosen privacy setting using job.user_id
  const chosenPrivacyOpt = (job.options as Record<string, string>)?.privacy;
  const resolvedPrivacy = await resolveImportPrivacy(
    admin,
    job.user_id,
    chosenPrivacyOpt
  );

  // 2. Atomically claim next up to 10 pending items
  let claimedItems: Array<{ id: string; row: unknown }> = [];

  const { data: rpcClaimed, error: rpcErr } = await admin.rpc(
    "claim_import_items",
    {
      p_job_id: jobId,
      p_limit: 10,
    }
  );

  if (!rpcErr && Array.isArray(rpcClaimed)) {
    claimedItems = rpcClaimed;
  } else {
    // Fallback claim via standard PostgREST select & update (including items stuck in processing > 2 min)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: pendingRows } = await admin
      .from("import_items")
      .select("id, row")
      .eq("job_id", jobId)
      .or(`status.eq.pending,and(status.eq.processing,or(claimed_at.is.null,claimed_at.lt.${twoMinutesAgo}))`)
      .order("created_at", { ascending: true })
      .limit(10);

    if (pendingRows && pendingRows.length > 0) {
      const itemIds = pendingRows.map((p) => p.id);
      await admin
        .from("import_items")
        .update({
          status: "processing",
          claimed_at: new Date().toISOString(),
        })
        .in("id", itemIds);

      claimedItems = pendingRows;
    }
  }

  // If no pending items were claimed, check if any pending or stuck items remain
  if (claimedItems.length === 0) {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: pendingCount } = await admin
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .or(`status.eq.pending,and(status.eq.processing,or(claimed_at.is.null,claimed_at.lt.${twoMinutesAgo}))`);

    if (!pendingCount || pendingCount === 0) {
      // Mark job as completed
      const { data: updatedJob } = await admin
        .from("import_jobs")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select()
        .single();

      return {
        success: true,
        status: "completed",
        processedBatchSize: 0,
        remaining: 0,
        job: updatedJob || job,
      };
    }

    return {
      success: true,
      status: "processing",
      processedBatchSize: 0,
      remaining: pendingCount,
      job,
    };
  }

  // 3. Process each claimed item
  let quotaHit = false;

  for (const item of claimedItems) {
    const row = item.row as unknown as ParsedImportItem;

    try {
      const match = await matchImportItem(row);

      if (match.status === "matched" && match.media_id) {
        // Check if already logged by user
        const { data: existingEntry } = await admin
          .from("entries")
          .select("id")
          .eq("user_id", job.user_id)
          .eq("media_id", match.media_id)
          .maybeSingle();

        if (existingEntry) {
          // Already logged: Leave it alone, count as already_logged
          await admin
            .from("import_items")
            .update({
              status: "already_logged",
              media_id: match.media_id,
            })
            .eq("id", item.id);
        } else {
          // Insert into entries without calling activity helpers
          const { error: insertEntryErr } = await admin
            .from("entries")
            .insert({
              user_id: job.user_id,
              media_id: match.media_id,
              status: row.status,
              rating: row.rating,
              review: row.review,
              contains_spoilers: row.contains_spoilers,
              privacy: resolvedPrivacy,
              completed_at: row.completed_at || null,
              created_at: row.completed_at || new Date().toISOString(),
            });

          if (insertEntryErr) {
            console.warn("Failed to insert imported entry:", insertEntryErr);
            // If failed due to unique constraint (23505) or similar
            if (insertEntryErr.code === "23505") {
              await admin
                .from("import_items")
                .update({
                  status: "already_logged",
                  media_id: match.media_id,
                })
                .eq("id", item.id);
            } else {
              await admin
                .from("import_items")
                .update({
                  status: "failed",
                  error: insertEntryErr.message || "Could not create diary entry",
                })
                .eq("id", item.id);
            }
          } else {
            await admin
              .from("import_items")
              .update({
                status: "matched",
                media_id: match.media_id,
              })
              .eq("id", item.id);
          }
        }
      } else if (match.status === "needs_review") {
        await admin
          .from("import_items")
          .update({
            status: "needs_review",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            candidates: (match.candidates || []) as any,
          })
          .eq("id", item.id);
      } else {
        // Failed
        await admin
          .from("import_items")
          .update({
            status: "failed",
            error: match.error || "Title not found in media catalog",
          })
          .eq("id", item.id);
      }
    } catch (err: unknown) {
      if (err instanceof UpstreamQuotaError) {
        quotaHit = true;
        // Revert this item back to pending
        await admin
          .from("import_items")
          .update({ status: "pending" })
          .eq("id", item.id);
        break;
      }

      // Other non-quota errors: mark item as failed with friendly reason
      await admin
        .from("import_items")
        .update({
          status: "failed",
          error: err instanceof Error ? err.message : "Processing error",
        })
        .eq("id", item.id);
    }
  }

  // 4. Recount job stats and update job status
  const [
    { count: matchedCount },
    { count: alreadyLoggedCount },
    { count: needsReviewCount },
    { count: failedCount },
    { count: remainingPendingCount },
  ] = await Promise.all([
    admin
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "matched"),
    admin
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "already_logged"),
    admin
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "needs_review"),
    admin
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "failed"),
    admin
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .in("status", ["pending", "processing"]),
  ]);

  const newJobStatus = quotaHit
    ? "paused"
    : (remainingPendingCount || 0) === 0
    ? "completed"
    : "processing";

  const { data: updatedJob } = await admin
    .from("import_jobs")
    .update({
      matched: matchedCount || 0,
      already_logged: alreadyLoggedCount || 0,
      needs_review: needsReviewCount || 0,
      failed: failedCount || 0,
      status: newJobStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select()
    .single();

  return {
    success: true,
    status: newJobStatus,
    processedBatchSize: claimedItems.length,
    remaining: remainingPendingCount || 0,
    job: updatedJob || job,
    quotaHit,
    message: quotaHit ? "Quota reached on upstream provider. Please resume later." : undefined,
  };
}
