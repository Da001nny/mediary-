/**
 * Algolia Search Integration for meDiary
 * Provides:
 *  - Client-side instant, typo-tolerant search-as-you-type using search-only API key
 *  - Server-side administrative indexing, batching & settings using admin API key
 *  - Formatters mapping public.media rows to Algolia records
 *  - Safe fallback for local/preview environments when keys are not yet configured
 */

import { algoliasearch } from "algoliasearch";
import type { MediaItem } from "@/types/database.types";

export interface AlgoliaMediaRecord {
  objectID: string;
  id: string;
  type: "movie" | "tv" | "game" | "book";
  title: string;
  cover_url?: string | null;
  release_date?: string | null;
  year?: number | null;
  genres: string[];
  synopsis?: string | null;
  community_rating_avg?: number | null;
  community_rating_count?: number;
  author?: string | null;
  director?: string | null;
  platforms?: string[];
  developer?: string | null;
  external_ids?: Record<string, unknown>;
  last_synced_at?: string;
  _highlightResult?: Record<
    string,
    {
      value: string;
      matchLevel: "none" | "partial" | "full";
      matchedWords: string[];
    }
  >;
  [key: string]: unknown;
}

export interface AlgoliaSearchResult {
  hits: AlgoliaMediaRecord[];
  totalHits: number;
  isAlgoliaLive: boolean;
  query: string;
  processingTimeMS?: number;
  error?: string | null;
}

// -------------------------------------------------------------
// Environment Configuration
// -------------------------------------------------------------
export function getAlgoliaClientConfig() {
  const appId =
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ||
    process.env.ALGOLIA_APP_ID ||
    "";
  const searchApiKey =
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY ||
    process.env.ALGOLIA_SEARCH_API_KEY ||
    "";
  const indexName =
    process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ||
    process.env.ALGOLIA_INDEX_NAME ||
    "media";

  return {
    appId,
    searchApiKey,
    indexName,
    isConfigured: Boolean(appId && searchApiKey),
  };
}

export function getAlgoliaServerConfig() {
  const clientConfig = getAlgoliaClientConfig();
  const adminApiKey =
    process.env.ALGOLIA_ADMIN_API_KEY ||
    process.env.ALGOLIA_API_KEY ||
    "";

  return {
    ...clientConfig,
    adminApiKey,
    isAdminConfigured: Boolean(clientConfig.appId && adminApiKey),
  };
}

// -------------------------------------------------------------
// Record Formatter
// -------------------------------------------------------------
export function formatMediaForAlgolia(media: MediaItem): AlgoliaMediaRecord {
  let year: number | null = null;
  if (media.release_date) {
    const y = parseInt(media.release_date.slice(0, 4), 10);
    if (!isNaN(y)) year = y;
  }

  // Extract type-specific fields if available
  const typeSpecific = (media.type_specific || {}) as Record<string, unknown>;
  const author = typeof typeSpecific.author === "string" ? typeSpecific.author : null;
  const director = typeof typeSpecific.director === "string" ? typeSpecific.director : null;
  const developer = typeof typeSpecific.developer === "string" ? typeSpecific.developer : null;
  const platforms = Array.isArray(typeSpecific.platforms)
    ? (typeSpecific.platforms as string[])
    : [];

  return {
    objectID: media.id,
    id: media.id,
    type: media.type,
    title: media.title,
    cover_url: media.cover_url,
    release_date: media.release_date,
    year,
    genres: media.genres || [],
    synopsis: media.synopsis,
    community_rating_avg: media.community_rating_avg,
    community_rating_count: media.community_rating_count || 0,
    author,
    director,
    platforms,
    developer,
    external_ids:
      typeof media.external_ids === "object" &&
      media.external_ids !== null &&
      !Array.isArray(media.external_ids)
        ? (media.external_ids as Record<string, unknown>)
        : {},
    last_synced_at: media.last_synced_at,
  };
}

// -------------------------------------------------------------
// Client-Side Search (Instant, Typo-Tolerant Search-As-You-Type)
// -------------------------------------------------------------
let clientInstance: ReturnType<typeof algoliasearch> | null = null;
let currentAppId = "";
let currentSearchKey = "";

function getSearchClient(appId: string, searchKey: string) {
  if (!clientInstance || currentAppId !== appId || currentSearchKey !== searchKey) {
    clientInstance = algoliasearch(appId, searchKey);
    currentAppId = appId;
    currentSearchKey = searchKey;
  }
  return clientInstance;
}

export async function searchAlgolia(
  query: string,
  options?: {
    typeFilter?: "all" | "movie" | "tv" | "game" | "book";
    hitsPerPage?: number;
    page?: number;
  }
): Promise<AlgoliaSearchResult> {
  const trimmed = query.trim();
  const { appId, searchApiKey, indexName, isConfigured } = getAlgoliaClientConfig();

  // If Algolia is not configured or in an environment without keys, fallback to local database
  if (!isConfigured) {
    try {
      const typeParam = options?.typeFilter && options.typeFilter !== "all" ? `&type=${options.typeFilter}` : "";
      const limitParam = options?.hitsPerPage ? `&limit=${options.hitsPerPage}` : "";
      const res = await fetch(`/api/media/search-db?q=${encodeURIComponent(trimmed)}${typeParam}${limitParam}`);
      if (res.ok) {
        const data = await res.json();
        return {
          hits: data.results || [],
          totalHits: data.count || (data.results || []).length,
          isAlgoliaLive: false,
          query: trimmed,
          error: null,
        };
      }
    } catch {
      // fallback failed
    }

    return {
      hits: [],
      totalHits: 0,
      isAlgoliaLive: false,
      query: trimmed,
      error: "Algolia credentials not configured. Please set NEXT_PUBLIC_ALGOLIA_APP_ID and NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY.",
    };
  }

  try {
    const client = getSearchClient(appId, searchApiKey);

    // Build filter string (facet filtering)
    let filters: string | undefined;
    if (options?.typeFilter && options.typeFilter !== "all") {
      filters = `type:${options.typeFilter}`;
    }

    const response = await client.searchSingleIndex({
      indexName,
      searchParams: {
        query: trimmed,
        filters,
        hitsPerPage: options?.hitsPerPage ?? 24,
        page: options?.page ?? 0,
        typoTolerance: true,
        highlightPreTag: "<mark class=\"bg-accent/25 text-accent font-semibold px-0.5 rounded\">",
        highlightPostTag: "</mark>",
        attributesToHighlight: ["title", "author", "director", "genres"],
      },
    });

    const hits = (response.hits || []) as unknown as AlgoliaMediaRecord[];

    return {
      hits,
      totalHits: response.nbHits ?? hits.length,
      isAlgoliaLive: true,
      query: trimmed,
      processingTimeMS: response.processingTimeMS,
      error: null,
    };
  } catch (err: unknown) {
    console.error("Algolia search error:", err);
    return {
      hits: [],
      totalHits: 0,
      isAlgoliaLive: false,
      query: trimmed,
      error: err instanceof Error ? err.message : "Failed to query Algolia index",
    };
  }
}

// -------------------------------------------------------------
// Server-Side Indexing, Batching & Settings (Admin Key Only)
// -------------------------------------------------------------
export function getAlgoliaAdminClient() {
  const { appId, adminApiKey, isAdminConfigured } = getAlgoliaServerConfig();
  if (!isAdminConfigured) {
    throw new Error(
      "Algolia Admin API is not configured. Set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY environment variables."
    );
  }
  return algoliasearch(appId, adminApiKey);
}

/**
 * Configure Algolia index settings for optimal search relevance, typo tolerance & faceting.
 */
export async function configureAlgoliaIndex() {
  const { indexName } = getAlgoliaServerConfig();
  const client = getAlgoliaAdminClient();

  return await client.setSettings({
    indexName,
    indexSettings: {
      searchableAttributes: [
        "title",
        "unordered(genres)",
        "author",
        "director",
        "developer",
        "synopsis",
      ],
      attributesForFaceting: [
        "filterOnly(type)",
        "genres",
        "year",
      ],
      customRanking: [
        "desc(community_rating_count)",
        "desc(community_rating_avg)",
        "desc(year)",
      ],
      typoTolerance: true,
      minWordSizefor1Typo: 4,
      minWordSizefor2Typos: 8,
      allowTyposOnNumericTokens: false,
      ignorePlurals: true,
      removeStopWords: true,
      queryType: "prefixLast",
    },
  });
}

/**
 * Push or update a single media item in Algolia
 */
export async function indexMediaItem(media: MediaItem) {
  const { indexName } = getAlgoliaServerConfig();
  const client = getAlgoliaAdminClient();
  const record = formatMediaForAlgolia(media);

  return await client.saveObject({
    indexName,
    body: record,
  });
}

/**
 * Delete a media item from Algolia
 */
export async function deleteMediaItem(id: string) {
  const { indexName } = getAlgoliaServerConfig();
  const client = getAlgoliaAdminClient();

  return await client.deleteObject({
    indexName,
    objectID: id,
  });
}

/**
 * Bulk index an array of media records into Algolia
 */
export async function bulkIndexMedia(items: MediaItem[]) {
  const { indexName } = getAlgoliaServerConfig();
  const client = getAlgoliaAdminClient();
  const records = items.map(formatMediaForAlgolia);

  if (records.length === 0) {
    return { count: 0, taskIDs: [] };
  }

  // saveObjects in batches of 1000
  const BATCH_SIZE = 1000;
  const results = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const res = await client.saveObjects({
      indexName,
      objects: chunk,
    });
    results.push(res);
  }

  return {
    count: records.length,
    results,
  };
}
