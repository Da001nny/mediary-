import type {
  CastMember,
  CrewMember,
  MediaType,
  WatchProvidersCountry,
} from "@/types/database.types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_W185 = "https://image.tmdb.org/t/p/w185";
export const TMDB_IMAGE_BASE_W342 = "https://image.tmdb.org/t/p/w342";
export const TMDB_IMAGE_BASE_W500 = "https://image.tmdb.org/t/p/w500";
export const TMDB_IMAGE_BASE_ORIGINAL = "https://image.tmdb.org/t/p/original";
export const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w92";

export interface TMDBNormalizedSearchResult {
  id: number;
  tmdb_id: number;
  type: "movie" | "tv";
  title: string;
  original_title: string | null;
  overview: string | null;
  release_date: string | null;
  year: number | null;
  poster_path: string | null;
  poster_thumbnail: string | null;
  poster_url: string | null;
  backdrop_path: string | null;
  backdrop_url: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TMDBTransformedDetails {
  type: MediaType;
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  overview: string | null;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string | null;
  year: number | null;
  status: string | null;
  runtime: number | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  genres: Array<{ id: number; name: string }> | string[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string | null;
  spoken_languages: Array<{ english_name?: string; iso_639_1?: string; name?: string }>;
  production_companies: Array<{ id: number; name: string; logo_path?: string | null }>;
  cast: CastMember[];
  crew: CrewMember[];
  credits: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  watch_providers: Record<string, WatchProvidersCountry>;
  raw_data: Record<string, unknown>;
  last_synced_at: string;
}

/**
 * Builds request options and URL for TMDB API, supporting both v3 API keys and v4 Read Access Bearer tokens.
 */
function getTMDBFetchConfig(endpoint: string, queryParams: Record<string, string | number> = {}) {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (!apiKey) {
    return { url: null, headers, apiKeyPresent: false };
  }

  // Check if token is v4 Bearer JWT or v3 API Key
  if (apiKey.startsWith("eyJ")) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return { url: url.toString(), headers, apiKeyPresent: true };
}

/**
 * Searches TMDB for movies, TV shows, or both.
 * Includes graceful mock fallbacks if TMDB_API_KEY is not yet populated.
 */
export async function searchTMDB(params: {
  query: string;
  type?: "all" | "movie" | "tv";
  page?: number;
}): Promise<{
  results: TMDBNormalizedSearchResult[];
  page: number;
  total_results: number;
  total_pages: number;
  isMock?: boolean;
}> {
  const { query, type = "all", page = 1 } = params;

  if (!query || query.trim() === "") {
    return { results: [], page: 1, total_results: 0, total_pages: 0 };
  }

  const endpoint =
    type === "movie"
      ? "/search/movie"
      : type === "tv"
      ? "/search/tv"
      : "/search/multi";

  const config = getTMDBFetchConfig(endpoint, {
    query: query.trim(),
    page,
    include_adult: "false",
    language: "en-US",
  });

  // If no API key is provided yet, return curated fallback results matching search query
  if (!config.apiKeyPresent || !config.url) {
    const mock = getMockSearchResults(query, type);
    return {
      results: mock,
      page: 1,
      total_results: mock.length,
      total_pages: 1,
      isMock: true,
    };
  }

  try {
    const res = await fetch(config.url, {
      headers: config.headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.warn("TMDB API key invalid or unauthorized, falling back to mock results.");
        const mock = getMockSearchResults(query, type);
        return {
          results: mock,
          page: 1,
          total_results: mock.length,
          total_pages: 1,
          isMock: true,
        };
      }
      throw new Error(`TMDB Search API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawResults = (data.results || []) as Array<Record<string, unknown>>;

    const results: TMDBNormalizedSearchResult[] = rawResults
      .filter((item) => {
        const itemType = (item.media_type as string) || (type !== "all" ? type : "movie");
        return itemType === "movie" || itemType === "tv";
      })
      .map((item) => {
        const itemType = ((item.media_type as string) || (type !== "all" ? type : "movie")) as
          | "movie"
          | "tv";
        const title = (item.title as string) || (item.name as string) || "Untitled";
        const originalTitle =
          (item.original_title as string) || (item.original_name as string) || null;
        const releaseDate =
          (item.release_date as string) || (item.first_air_date as string) || null;
        const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null;
        const posterPath = (item.poster_path as string) || null;
        const backdropPath = (item.backdrop_path as string) || null;

        return {
          id: Number(item.id),
          tmdb_id: Number(item.id),
          type: itemType,
          title,
          original_title: originalTitle,
          overview: (item.overview as string) || null,
          release_date: releaseDate,
          year,
          poster_path: posterPath,
          poster_thumbnail: posterPath ? `${TMDB_IMAGE_BASE_W185}${posterPath}` : null,
          poster_url: posterPath ? `${TMDB_IMAGE_BASE_W342}${posterPath}` : null,
          backdrop_path: backdropPath,
          backdrop_url: backdropPath ? `${TMDB_IMAGE_BASE_W500}${backdropPath}` : null,
          vote_average: Number(item.vote_average || 0),
          vote_count: Number(item.vote_count || 0),
          popularity: Number(item.popularity || 0),
        };
      });

    return {
      results,
      page: Number(data.page || 1),
      total_results: Number(data.total_results || results.length),
      total_pages: Number(data.total_pages || 1),
      isMock: false,
    };
  } catch (error) {
    console.error("TMDB search error:", error);
    const mock = getMockSearchResults(query, type);
    return {
      results: mock,
      page: 1,
      total_results: mock.length,
      total_pages: 1,
      isMock: true,
    };
  }
}

/**
 * Fetches full details for a Movie or TV show from TMDB, appending credits and watch providers.
 */
export async function fetchTMDBDetails(
  id: number | string,
  type: "movie" | "tv" = "movie"
): Promise<{ data: TMDBTransformedDetails | null; error: string | null; isMock?: boolean }> {
  const numericId = typeof id === "string" ? parseInt(id, 10) : id;
  if (!numericId || isNaN(numericId)) {
    return { data: null, error: "Invalid TMDB ID provided" };
  }

  const endpoint = `/${type}/${numericId}`;
  const config = getTMDBFetchConfig(endpoint, {
    append_to_response: "credits,watch/providers,external_ids",
    language: "en-US",
  });

  if (!config.apiKeyPresent || !config.url) {
    const mockDetails = getMockDetails(numericId, type);
    return { data: mockDetails, error: null, isMock: true };
  }

  try {
    const res = await fetch(config.url, {
      headers: config.headers,
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { data: null, error: `Media item with ID ${numericId} not found on TMDB` };
      }
      if (res.status === 401) {
        console.warn("TMDB API key unauthorized, returning mock details.");
        return { data: getMockDetails(numericId, type), error: null, isMock: true };
      }
      return { data: null, error: `TMDB Details API error: ${res.status} ${res.statusText}` };
    }

    const json = await res.json();
    const transformed = transformTMDBDetails(json, type, numericId);
    return { data: transformed, error: null, isMock: false };
  } catch (err) {
    console.error("fetchTMDBDetails exception:", err);
    return { data: getMockDetails(numericId, type), error: null, isMock: true };
  }
}

/**
 * Normalizes raw TMDB details response into the meDiary media table schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformTMDBDetails(raw: any, type: "movie" | "tv", tmdbId: number): TMDBTransformedDetails {
  const isMovie = type === "movie";
  const title = (raw.title || raw.name || "Untitled") as string;
  const originalTitle = (raw.original_title || raw.original_name || null) as string | null;
  const releaseDate = (raw.release_date || raw.first_air_date || null) as string | null;
  const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null;
  const posterPath = (raw.poster_path || null) as string | null;
  const backdropPath = (raw.backdrop_path || null) as string | null;

  // Extract Cast (top 20)
  const rawCast = Array.isArray(raw.credits?.cast) ? raw.credits.cast : [];
  const cast: CastMember[] = rawCast.slice(0, 20).map((c: Record<string, unknown>, index: number) => ({
    id: Number(c.id),
    name: String(c.name || "Unknown"),
    character: (c.character as string) || undefined,
    profile_path: (c.profile_path as string) || null,
    order: typeof c.order === "number" ? c.order : index,
  }));

  // Extract Key Crew (directors, writers, creators, producers, composers)
  const rawCrew = Array.isArray(raw.credits?.crew) ? raw.credits.crew : [];
  const keyJobs = new Set([
    "Director",
    "Screenplay",
    "Writer",
    "Original Music Composer",
    "Director of Photography",
    "Producer",
    "Executive Producer",
    "Creator",
  ]);

  const filteredCrew: CrewMember[] = rawCrew
    .filter((c: Record<string, unknown>) => keyJobs.has(String(c.job || "")))
    .slice(0, 20)
    .map((c: Record<string, unknown>) => ({
      id: Number(c.id),
      name: String(c.name || "Unknown"),
      job: (c.job as string) || undefined,
      department: (c.department as string) || undefined,
      profile_path: (c.profile_path as string) || null,
    }));

  // For TV shows, add created_by into crew if not already present
  if (!isMovie && Array.isArray(raw.created_by)) {
    for (const creator of raw.created_by) {
      if (!filteredCrew.some((c) => c.id === creator.id)) {
        filteredCrew.unshift({
          id: Number(creator.id),
          name: String(creator.name || "Unknown"),
          job: "Creator",
          department: "Writing",
          profile_path: creator.profile_path || null,
        });
      }
    }
  }

  // Extract Watch Providers
  // TMDB format: raw['watch/providers']?.results or raw.watch_providers?.results
  const rawProviders =
    raw["watch/providers"]?.results || raw.watch_providers?.results || {};

  const watchProviders: Record<string, WatchProvidersCountry> = {};
  for (const [countryCode, providerData] of Object.entries(rawProviders)) {
    if (providerData && typeof providerData === "object") {
      const p = providerData as Record<string, unknown>;
      watchProviders[countryCode] = {
        link: (p.link as string) || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flatrate: Array.isArray(p.flatrate) ? p.flatrate.map((item: any) => ({
          provider_id: item.provider_id,
          provider_name: item.provider_name,
          logo_path: item.logo_path || null,
          display_priority: item.display_priority,
        })) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rent: Array.isArray(p.rent) ? p.rent.map((item: any) => ({
          provider_id: item.provider_id,
          provider_name: item.provider_name,
          logo_path: item.logo_path || null,
          display_priority: item.display_priority,
        })) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buy: Array.isArray(p.buy) ? p.buy.map((item: any) => ({
          provider_id: item.provider_id,
          provider_name: item.provider_name,
          logo_path: item.logo_path || null,
          display_priority: item.display_priority,
        })) : undefined,
      };
    }
  }

  // Runtime calculation
  let runtime: number | null = null;
  if (isMovie && typeof raw.runtime === "number") {
    runtime = raw.runtime;
  } else if (!isMovie && Array.isArray(raw.episode_run_time) && raw.episode_run_time.length > 0) {
    runtime = Number(raw.episode_run_time[0]) || null;
  }

  // External IDs (e.g. IMDb ID)
  const imdbId = (raw.external_ids?.imdb_id || raw.imdb_id || null) as string | null;

  return {
    type,
    tmdb_id: tmdbId,
    imdb_id: imdbId,
    title,
    original_title: originalTitle,
    overview: (raw.overview || null) as string | null,
    tagline: (raw.tagline || null) as string | null,
    poster_path: posterPath,
    backdrop_path: backdropPath,
    poster_url: posterPath ? `${TMDB_IMAGE_BASE_W500}${posterPath}` : null,
    backdrop_url: backdropPath ? `${TMDB_IMAGE_BASE_ORIGINAL}${backdropPath}` : null,
    release_date: releaseDate,
    year,
    status: (raw.status || null) as string | null,
    runtime,
    number_of_seasons: typeof raw.number_of_seasons === "number" ? raw.number_of_seasons : null,
    number_of_episodes: typeof raw.number_of_episodes === "number" ? raw.number_of_episodes : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    genres: Array.isArray(raw.genres) ? raw.genres.map((g: any) => ({ id: g.id, name: g.name })) : [],
    vote_average: Number(raw.vote_average || 0),
    vote_count: Number(raw.vote_count || 0),
    popularity: Number(raw.popularity || 0),
    original_language: (raw.original_language || null) as string | null,
    spoken_languages: Array.isArray(raw.spoken_languages) ? raw.spoken_languages : [],
    production_companies: Array.isArray(raw.production_companies) ? raw.production_companies : [],
    cast,
    crew: filteredCrew,
    credits: {
      cast,
      crew: filteredCrew,
    },
    watch_providers: watchProviders,
    raw_data: {
      homepage: raw.homepage || null,
      budget: raw.budget || null,
      revenue: raw.revenue || null,
      origin_country: raw.origin_country || null,
      networks: raw.networks || null,
    },
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Curated mock items when TMDB_API_KEY is not configured yet.
 */
function getMockSearchResults(query: string, type: "all" | "movie" | "tv"): TMDBNormalizedSearchResult[] {
  const catalog: TMDBNormalizedSearchResult[] = [
    {
      id: 550,
      tmdb_id: 550,
      type: "movie",
      title: "Fight Club",
      original_title: "Fight Club",
      overview: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.",
      release_date: "1999-10-15",
      year: 1999,
      poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      poster_thumbnail: "https://image.tmdb.org/t/p/w185/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      poster_url: "https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      backdrop_path: "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",
      backdrop_url: "https://image.tmdb.org/t/p/w500/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",
      vote_average: 8.4,
      vote_count: 28410,
      popularity: 94.3,
    },
    {
      id: 157336,
      tmdb_id: 157336,
      type: "movie",
      title: "Interstellar",
      original_title: "Interstellar",
      overview: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.",
      release_date: "2014-11-05",
      year: 2014,
      poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      poster_thumbnail: "https://image.tmdb.org/t/p/w185/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      poster_url: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      backdrop_path: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
      backdrop_url: "https://image.tmdb.org/t/p/w500/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
      vote_average: 8.4,
      vote_count: 35120,
      popularity: 142.1,
    },
    {
      id: 129,
      tmdb_id: 129,
      type: "movie",
      title: "Spirited Away",
      original_title: "千と千尋の神隠し",
      overview: "A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.",
      release_date: "2001-07-20",
      year: 2001,
      poster_path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
      poster_thumbnail: "https://image.tmdb.org/t/p/w185/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
      poster_url: "https://image.tmdb.org/t/p/w342/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
      backdrop_path: "/mSDvdgmvQ0mQ0V6E6973jRzFhT.jpg",
      backdrop_url: "https://image.tmdb.org/t/p/w500/mSDvdgmvQ0mQ0V6E6973jRzFhT.jpg",
      vote_average: 8.5,
      vote_count: 16200,
      popularity: 88.5,
    },
    {
      id: 94605,
      tmdb_id: 94605,
      type: "tv",
      title: "Arcane",
      original_title: "Arcane",
      overview: "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and incompatible convictions.",
      release_date: "2021-11-06",
      year: 2021,
      poster_path: "/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
      poster_thumbnail: "https://image.tmdb.org/t/p/w185/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
      poster_url: "https://image.tmdb.org/t/p/w342/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",
      backdrop_path: "/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg",
      backdrop_url: "https://image.tmdb.org/t/p/w500/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg",
      vote_average: 8.7,
      vote_count: 4200,
      popularity: 110.8,
    },
    {
      id: 95557,
      tmdb_id: 95557,
      type: "tv",
      title: "Severance",
      original_title: "Severance",
      overview: "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
      release_date: "2022-02-17",
      year: 2022,
      poster_path: "/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg",
      poster_thumbnail: "https://image.tmdb.org/t/p/w185/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg",
      poster_url: "https://image.tmdb.org/t/p/w342/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg",
      backdrop_path: "/98n2qM62nS2w87V0QW1p7R0Wz6f.jpg",
      backdrop_url: "https://image.tmdb.org/t/p/w500/98n2qM62nS2w87V0QW1p7R0Wz6f.jpg",
      vote_average: 8.4,
      vote_count: 1450,
      popularity: 76.2,
    },
  ];

  const lowerQ = query.toLowerCase();
  return catalog.filter((item) => {
    const matchesType = type === "all" || item.type === type;
    const matchesQuery = item.title.toLowerCase().includes(lowerQ) ||
      (item.overview && item.overview.toLowerCase().includes(lowerQ));
    return matchesType && (lowerQ.length === 0 || matchesQuery);
  });
}

function getMockDetails(tmdbId: number, type: "movie" | "tv"): TMDBTransformedDetails {
  const isMovie = type === "movie";
  return {
    type,
    tmdb_id: tmdbId,
    imdb_id: isMovie ? "tt0137523" : "tt11126994",
    title: isMovie ? "Fight Club" : "Severance",
    original_title: isMovie ? "Fight Club" : "Severance",
    overview: isMovie
      ? "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more."
      : "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
    tagline: isMovie ? "Mischief. Mayhem. Soap." : "Please do not attempt to remember yourself.",
    poster_path: isMovie ? "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg" : "/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg",
    backdrop_path: isMovie ? "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg" : "/98n2qM62nS2w87V0QW1p7R0Wz6f.jpg",
    poster_url: `${TMDB_IMAGE_BASE_W500}${isMovie ? "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg" : "/pG0vMpsuXpZ23B330i3sI6u2t9a.jpg"}`,
    backdrop_url: `${TMDB_IMAGE_BASE_ORIGINAL}${isMovie ? "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg" : "/98n2qM62nS2w87V0QW1p7R0Wz6f.jpg"}`,
    release_date: isMovie ? "1999-10-15" : "2022-02-17",
    year: isMovie ? 1999 : 2022,
    status: isMovie ? "Released" : "Returning Series",
    runtime: isMovie ? 139 : 50,
    number_of_seasons: isMovie ? null : 2,
    number_of_episodes: isMovie ? null : 19,
    genres: [
      { id: 18, name: "Drama" },
      { id: 53, name: "Thriller" },
    ],
    vote_average: 8.4,
    vote_count: isMovie ? 28410 : 1450,
    popularity: 94.3,
    original_language: "en",
    spoken_languages: [{ english_name: "English", iso_639_1: "en", name: "English" }],
    production_companies: [
      { id: 508, name: "Regency Enterprises" },
      { id: 711, name: "Fox 2000 Pictures" },
    ],
    cast: [
      { id: 819, name: "Edward Norton", character: "The Narrator", order: 0 },
      { id: 287, name: "Brad Pitt", character: "Tyler Durden", order: 1 },
      { id: 1283, name: "Helena Bonham Carter", character: "Marla Singer", order: 2 },
      { id: 7447, name: "Meat Loaf", character: "Robert 'Bob' Paulson", order: 3 },
    ],
    crew: [
      { id: 7467, name: "David Fincher", job: "Director", department: "Directing" },
      { id: 7468, name: "Chuck Palahniuk", job: "Novel", department: "Writing" },
      { id: 7469, name: "Jim Uhls", job: "Screenplay", department: "Writing" },
      { id: 1259, name: "The Dust Brothers", job: "Original Music Composer", department: "Sound" },
    ],
    credits: {
      cast: [
        { id: 819, name: "Edward Norton", character: "The Narrator", order: 0 },
        { id: 287, name: "Brad Pitt", character: "Tyler Durden", order: 1 },
      ],
      crew: [
        { id: 7467, name: "David Fincher", job: "Director", department: "Directing" },
      ],
    },
    watch_providers: {
      US: {
        link: "https://www.themoviedb.org/movie/550-fight-club/watch?locale=US",
        flatrate: [
          { provider_id: 1796, provider_name: "Netflix Standard with Ads", logo_path: "/97yvRBw1Gz2dtDCUEb6lhWq359n.jpg" },
        ],
        rent: [
          { provider_id: 2, provider_name: "Apple TV", logo_path: "/9ghgSC0MA0R22509R1NDvOaF1o.jpg" },
          { provider_id: 3, provider_name: "Google Play Movies", logo_path: "/8z7rC8uIDaTM91X0ZPtE79enucL.jpg" },
          { provider_id: 10, provider_name: "Amazon Video", logo_path: "/seGSsoGmUQrikqen9690gwdJuSV.jpg" },
        ],
        buy: [
          { provider_id: 2, provider_name: "Apple TV", logo_path: "/9ghgSC0MA0R22509R1NDvOaF1o.jpg" },
          { provider_id: 10, provider_name: "Amazon Video", logo_path: "/seGSsoGmUQrikqen9690gwdJuSV.jpg" },
        ],
      },
    },
    raw_data: {
      mock: true,
      budget: 63000000,
      revenue: 100853753,
    },
    last_synced_at: new Date().toISOString(),
  };
}
