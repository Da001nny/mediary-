import { createAdminClient } from "@/lib/supabase/admin";
import { indexMediaItem } from "@/lib/algolia";
import { fetchTMDBDetails, TMDB_IMAGE_BASE_W500, TMDB_IMAGE_BASE_ORIGINAL } from "@/lib/tmdb";
import { fetchRAWGGameDetails, rawgGameToMediaPayload } from "@/lib/rawg";
import {
  fetchGoogleBookDetails,
  bookToMediaPayload,
  formatBookCoverUrl,
} from "@/lib/google-books";
import type { MediaItem, Json, PrivacyLevel } from "@/types/database.types";
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
 * Searches the local database media catalog for an existing movie or book.
 */
export async function findExistingMedia(
  item: ParsedImportItem
): Promise<MediaItem | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  if (item.source === "letterboxd") {
    // 1. Search movies by title
    const { data: movies } = await admin
      .from("media")
      .select("*")
      .eq("type", "movie")
      .ilike("title", item.title.trim())
      .limit(10);

    if (movies && movies.length > 0) {
      if (item.year) {
        const yearMatch = movies.find((m) => {
          const mYear = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null;
          return mYear === item.year;
        });
        if (yearMatch) return yearMatch as unknown as MediaItem;
      } else {
        return movies[0] as unknown as MediaItem;
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

    // 3. Search books by Title
    const { data: titleMatches } = await admin
      .from("media")
      .select("*")
      .eq("type", "book")
      .ilike("title", item.title.trim())
      .limit(5);

    if (titleMatches && titleMatches.length > 0) {
      if (item.author) {
        const cleanAuthor = item.author.toLowerCase().trim();
        const authorMatch = titleMatches.find((m) => {
          const typeSpec = (m.type_specific as Record<string, unknown>) || {};
          const bookAuthor = String(typeSpec.author || "").toLowerCase();
          return bookAuthor.includes(cleanAuthor) || cleanAuthor.includes(bookAuthor);
        });
        if (authorMatch) return authorMatch as unknown as MediaItem;
      } else {
        return titleMatches[0] as unknown as MediaItem;
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
 * Searches TMDB for movie candidates without mock fallback.
 */
export async function searchTMDBReal(
  query: string
): Promise<{ results: Array<{ id: number; title: string; release_date?: string; poster_path?: string; overview?: string }> }> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured in server environment");
  }

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", query.trim());
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
 */
export async function matchImportItem(
  item: ParsedImportItem
): Promise<MatchResult> {
  const cacheKey =
    item.source === "letterboxd"
      ? `movie:${item.title.toLowerCase().trim()}:${item.year || ""}`
      : `book:${item.isbn13 || item.isbn10 || item.title.toLowerCase().trim() + ":" + (item.author || "")}`;

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
      const { results } = await searchTMDBReal(item.title);

      if (!results || results.length === 0) {
        const result: MatchResult = {
          status: "needs_review",
          candidates: [],
        };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // Check for exact year match
      const targetYear = item.year;
      const exactYearMatches = targetYear
        ? results.filter((r) => {
            const y = r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null;
            return y === targetYear;
          })
        : [];

      // Accept exact year match ONLY if exactly one candidate matches that year
      if (exactYearMatches.length === 1) {
        const matchedTmdb = exactYearMatches[0];
        const mediaId = await syncTMDBMovieToMedia(matchedTmdb.id);
        const result: MatchResult = { status: "matched", media_id: mediaId };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // If several candidates match or none do, mark needs_review with up to 5 candidates
      const candidates: CandidateItem[] = results.slice(0, 5).map((r) => ({
        tmdb_id: r.id,
        title: r.title,
        year: r.release_date ? r.release_date.slice(0, 4) : null,
        poster_url: r.poster_path
          ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
          : null,
        overview: r.overview ? r.overview.slice(0, 250) : null,
      }));

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
        if (items.length > 0) {
          const mediaId = await syncGoogleBookToMedia(items[0].id);
          const result: MatchResult = { status: "matched", media_id: mediaId };
          catalogLookupCache.set(cacheKey, result);
          return result;
        }
      }

      // Step B: Search via ISBN-10
      if (item.isbn10) {
        const { items } = await searchGoogleBooksReal(`isbn:${item.isbn10}`);
        if (items.length > 0) {
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

      const { items } = await searchGoogleBooksReal(q);

      if (items.length === 0) {
        const result: MatchResult = {
          status: "needs_review",
          candidates: [],
        };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // If exactly 1 result returned with high confidence
      if (items.length === 1) {
        const mediaId = await syncGoogleBookToMedia(items[0].id);
        const result: MatchResult = { status: "matched", media_id: mediaId };
        catalogLookupCache.set(cacheKey, result);
        return result;
      }

      // Multiple candidates: mark needs_review with up to 5 candidates
      const candidates: CandidateItem[] = items.slice(0, 5).map((b) => {
        const v = (b.volumeInfo || {}) as Record<string, unknown>;
        const authors = Array.isArray(v.authors) ? v.authors : [];
        const imageLinks = (v.imageLinks as Record<string, string>) || {};
        return {
          google_books_id: b.id,
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
