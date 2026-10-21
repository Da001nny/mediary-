import type { Json } from "@/types/database.types";

export interface RAWGPlatform {
  platform: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface RAWGDeveloper {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGPublisher {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGGenre {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGGameSearchResult {
  id: number;
  rawg_id: number;
  type: "game";
  title: string;
  slug: string;
  release_date: string | null;
  year: number | null;
  cover_url: string | null;
  backdrop_url: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  genres: string[];
  platforms: string[];
}

export interface RAWGGameDetails {
  id: number;
  slug: string;
  name: string;
  name_original?: string;
  description: string;
  description_raw?: string;
  metacritic: number | null;
  released: string | null;
  background_image: string | null;
  background_image_additional?: string | null;
  website: string | null;
  rating: number;
  rating_top?: number;
  ratings_count: number;
  playtime: number;
  esrb_rating: { id: number; name: string; slug: string } | null;
  platforms: Array<{
    platform: { id: number; name: string; slug: string };
    requirements?: { minimum?: string; recommended?: string };
  }>;
  developers: Array<{ id: number; name: string; slug: string }>;
  publishers: Array<{ id: number; name: string; slug: string }>;
  genres: Array<{ id: number; name: string; slug: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  short_screenshots?: Array<{ id: number; image: string }>;
}

export interface RAWGTransformedGame {
  type: "game";
  rawg_id: number;
  title: string;
  slug: string;
  cover_url: string | null;
  backdrop_url: string | null;
  release_date: string | null;
  year: number | null;
  synopsis: string | null;
  genres: string[];
  type_specific: {
    platforms: string[];
    platform_played_on?: string | null;
    developers: string[];
    publishers: string[];
    developer: string;
    publisher: string;
    genre: string;
    metacritic: number | null;
    esrb_rating: string | null;
    website: string | null;
    playtime: number;
    screenshots: string[];
    backdrop_url: string | null;
  };
  external_ids: {
    rawg_id: number;
    slug: string;
  };
  community_rating_avg: number;
  community_rating_count: number;
  last_synced_at: string;
}

const RAWG_BASE_URL = "https://api.rawg.io/api";

/**
 * Builds request options and URL for RAWG API.
 */
function getRAWGFetchConfig(
  endpoint: string,
  queryParams: Record<string, string | number> = {}
) {
  const apiKey = process.env.RAWG_API_KEY?.trim();
  const url = new URL(`${RAWG_BASE_URL}${endpoint}`);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (!apiKey) {
    return { url: null, headers, apiKeyPresent: false };
  }

  url.searchParams.set("key", apiKey);

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return { url: url.toString(), headers, apiKeyPresent: true };
}

/**
 * Fetches the top games from RAWG, ordered by most recently released with highest added count
 * (ordering=-added and dates range covering the last 12 months).
 */
export async function fetchRAWGTrendingGames(
  limit = 20
): Promise<Array<{ id: number; name?: string; slug?: string }>> {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDate = oneYearAgo.toISOString().slice(0, 10);
  const dates = `${startDate},${endDate}`;

  const config = getRAWGFetchConfig("/games", {
    ordering: "-added",
    dates,
    page_size: limit,
  });

  if (!config.apiKeyPresent || !config.url) {
    throw new Error("RAWG_API_KEY environment variable is not configured");
  }

  const res = await fetch(config.url, { headers: config.headers });
  if (!res.ok) {
    throw new Error(`RAWG trending games fetch failed with status ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results.slice(0, limit) : [];
}

/**
 * Curated high-fidelity mock game database for development, testing, and offline resilience.
 */
export const MOCK_GAMES: RAWGTransformedGame[] = [
  {
    type: "game",
    rawg_id: 3498,
    title: "Elden Ring",
    slug: "elden-ring",
    cover_url:
      "https://media.rawg.io/media/games/b29/b293156272e604f78b286db7a4a20053.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/003/0034a7429d3f22977900ec4160d7ec63.jpg",
    release_date: "2022-02-25",
    year: 2022,
    synopsis:
      "THE NEW FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between. A vast world where open fields with a variety of situations and huge dungeons with complex and three-dimensional designs are seamlessly connected.",
    genres: ["Action", "RPG", "Open World", "Souls-like"],
    type_specific: {
      platforms: ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One"],
      platform_played_on: "PC",
      developers: ["FromSoftware"],
      publishers: ["Bandai Namco Entertainment"],
      developer: "FromSoftware",
      publisher: "Bandai Namco Entertainment",
      genre: "Action RPG",
      metacritic: 96,
      esrb_rating: "Mature 17+",
      website: "https://www.eldenring.jp",
      playtime: 60,
      screenshots: [
        "https://media.rawg.io/media/screenshots/003/0034a7429d3f22977900ec4160d7ec63.jpg",
        "https://media.rawg.io/media/screenshots/23f/23f713e71d37e2b70d496a75f5cbb346.jpg",
        "https://media.rawg.io/media/screenshots/823/823d069b1742468307db1854bb691515.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/003/0034a7429d3f22977900ec4160d7ec63.jpg",
    },
    external_ids: {
      rawg_id: 3498,
      slug: "elden-ring",
    },
    community_rating_avg: 4.8,
    community_rating_count: 5120,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 326243,
    title: "The Legend of Zelda: Tears of the Kingdom",
    slug: "the-legend-of-zelda-tears-of-the-kingdom",
    cover_url:
      "https://media.rawg.io/media/games/9b1/9b1e944439c148e47db2061ff1b55972.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/d79/d79718aa6a7e0e7a2b97c2317ef2f260.jpg",
    release_date: "2023-05-12",
    year: 2023,
    synopsis:
      "An epic adventure across the land and skies of Hyrule awaits in The Legend of Zelda: Tears of the Kingdom for Nintendo Switch. The adventure is yours to create in a world fueled by your imagination. In this sequel to Breath of the Wild, harness Link's new abilities to fight back against the malevolent forces threatening the kingdom.",
    genres: ["Action-Adventure", "Open World", "Fantasy"],
    type_specific: {
      platforms: ["Nintendo Switch"],
      platform_played_on: "Nintendo Switch",
      developers: ["Nintendo EPD"],
      publishers: ["Nintendo"],
      developer: "Nintendo EPD",
      publisher: "Nintendo",
      genre: "Action-Adventure",
      metacritic: 96,
      esrb_rating: "Everyone 10+",
      website: "https://www.zelda.com/tears-of-the-kingdom/",
      playtime: 75,
      screenshots: [
        "https://media.rawg.io/media/screenshots/d79/d79718aa6a7e0e7a2b97c2317ef2f260.jpg",
        "https://media.rawg.io/media/screenshots/5bc/5bca5a195eecb2d2e16f393fa91bb5f4.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/d79/d79718aa6a7e0e7a2b97c2317ef2f260.jpg",
    },
    external_ids: {
      rawg_id: 326243,
      slug: "the-legend-of-zelda-tears-of-the-kingdom",
    },
    community_rating_avg: 4.9,
    community_rating_count: 3280,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 452634,
    title: "Baldur's Gate 3",
    slug: "baldurs-gate-3",
    cover_url:
      "https://media.rawg.io/media/games/699/69907e1d9406085a69074092b3c22b92.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/4da/4da1f760da61b07f4339e7bdfa5a0cb0.jpg",
    release_date: "2023-08-03",
    year: 2023,
    synopsis:
      "Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power. Mysterious abilities are awakening inside you, drawn from a mind flayer parasite planted in your brain.",
    genres: ["RPG", "Strategy", "Turn-Based", "Fantasy"],
    type_specific: {
      platforms: ["PC", "PlayStation 5", "Xbox Series X/S", "macOS"],
      platform_played_on: "PC",
      developers: ["Larian Studios"],
      publishers: ["Larian Studios"],
      developer: "Larian Studios",
      publisher: "Larian Studios",
      genre: "CRPG",
      metacritic: 96,
      esrb_rating: "Mature 17+",
      website: "https://baldursgate3.game",
      playtime: 100,
      screenshots: [
        "https://media.rawg.io/media/screenshots/4da/4da1f760da61b07f4339e7bdfa5a0cb0.jpg",
        "https://media.rawg.io/media/screenshots/23f/23f713e71d37e2b70d496a75f5cbb346.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/4da/4da1f760da61b07f4339e7bdfa5a0cb0.jpg",
    },
    external_ids: {
      rawg_id: 452634,
      slug: "baldurs-gate-3",
    },
    community_rating_avg: 4.9,
    community_rating_count: 4890,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 28,
    title: "Red Dead Redemption 2",
    slug: "red-dead-redemption-2",
    cover_url:
      "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/166/16658822368943c2c1032df4c29ea771.jpg",
    release_date: "2018-10-26",
    year: 2018,
    synopsis:
      "America, 1899. The end of the wild west era has begun as lawmen hunt down the last remaining outlaw gangs. Those who will not surrender or succumb are killed. Arthur Morgan and the Van der Linde gang must rob, steal, and fight their way across the rugged heartland of America in order to survive.",
    genres: ["Action", "Adventure", "Open World", "Western"],
    type_specific: {
      platforms: ["PC", "PlayStation 4", "Xbox One"],
      platform_played_on: "PlayStation 4",
      developers: ["Rockstar Games", "Rockstar Studios"],
      publishers: ["Rockstar Games"],
      developer: "Rockstar Studios",
      publisher: "Rockstar Games",
      genre: "Action-Adventure",
      metacritic: 97,
      esrb_rating: "Mature 17+",
      website: "https://www.rockstargames.com/reddeadredemption2",
      playtime: 80,
      screenshots: [
        "https://media.rawg.io/media/screenshots/166/16658822368943c2c1032df4c29ea771.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/166/16658822368943c2c1032df4c29ea771.jpg",
    },
    external_ids: {
      rawg_id: 28,
      slug: "red-dead-redemption-2",
    },
    community_rating_avg: 4.8,
    community_rating_count: 6150,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 41494,
    title: "Cyberpunk 2077",
    slug: "cyberpunk-2077",
    cover_url:
      "https://media.rawg.io/media/games/26d/26d4437a21a500c498b1126c73d3d1ed.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/a7e/a7e990bc57ecc313fe3ff86a0572337f.jpg",
    release_date: "2020-12-10",
    year: 2020,
    synopsis:
      "Cyberpunk 2077 is an open-world, action-adventure RPG set in the megalopolis of Night City, where you play as a cyberpunk mercenary wrapped up in a do-or-die fight for survival. Upgraded with next-gen in mind and featuring free additional content.",
    genres: ["Action", "RPG", "Sci-Fi", "Open World"],
    type_specific: {
      platforms: ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One"],
      platform_played_on: "PC",
      developers: ["CD PROJEKT RED"],
      publishers: ["CD PROJEKT RED"],
      developer: "CD PROJEKT RED",
      publisher: "CD PROJEKT RED",
      genre: "Sci-Fi RPG",
      metacritic: 86,
      esrb_rating: "Mature 17+",
      website: "https://www.cyberpunk.net",
      playtime: 45,
      screenshots: [
        "https://media.rawg.io/media/screenshots/a7e/a7e990bc57ecc313fe3ff86a0572337f.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/a7e/a7e990bc57ecc313fe3ff86a0572337f.jpg",
    },
    external_ids: {
      rawg_id: 41494,
      slug: "cyberpunk-2077",
    },
    community_rating_avg: 4.5,
    community_rating_count: 4200,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 654,
    title: "Stardew Valley",
    slug: "stardew-valley",
    cover_url:
      "https://media.rawg.io/media/games/713/713264228b964863c8a9b10fcd6f630a.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/115/115d909da425b42cf431bc40ee47a329.jpg",
    release_date: "2016-02-26",
    year: 2016,
    synopsis:
      "You've inherited your grandfather's old farm plot in Stardew Valley. Armed with hand-me-down tools and a few coins, you set out to begin your new life. Can you learn to live off the land and turn these overgrown fields into a thriving home?",
    genres: ["Simulation", "RPG", "Indie", "Farming"],
    type_specific: {
      platforms: ["PC", "Nintendo Switch", "PlayStation 4", "Xbox One", "iOS", "Android"],
      platform_played_on: "Nintendo Switch",
      developers: ["ConcernedApe"],
      publishers: ["ConcernedApe"],
      developer: "ConcernedApe",
      publisher: "ConcernedApe",
      genre: "Farming Simulation RPG",
      metacritic: 89,
      esrb_rating: "Everyone 10+",
      website: "https://www.stardewvalley.net",
      playtime: 120,
      screenshots: [
        "https://media.rawg.io/media/screenshots/115/115d909da425b42cf431bc40ee47a329.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/115/115d909da425b42cf431bc40ee47a329.jpg",
    },
    external_ids: {
      rawg_id: 654,
      slug: "stardew-valley",
    },
    community_rating_avg: 4.8,
    community_rating_count: 3950,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 9767,
    title: "Hollow Knight",
    slug: "hollow-knight",
    cover_url:
      "https://media.rawg.io/media/games/4cf/4cfc6b7f1850590a4634b08bfab308ab.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/b95/b95ff8ebae956be848f226b86abf63ce.jpg",
    release_date: "2017-02-24",
    year: 2017,
    synopsis:
      "Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes. Explore twisting caverns, battle tainted creatures and befriend bizarre bugs, all in classic 2D hand-drawn style.",
    genres: ["Action", "Metroidvania", "Indie", "Platformer"],
    type_specific: {
      platforms: ["PC", "Nintendo Switch", "PlayStation 4", "Xbox One", "macOS", "Linux"],
      platform_played_on: "Nintendo Switch",
      developers: ["Team Cherry"],
      publishers: ["Team Cherry"],
      developer: "Team Cherry",
      publisher: "Team Cherry",
      genre: "Metroidvania",
      metacritic: 90,
      esrb_rating: "Everyone 10+",
      website: "https://www.hollowknight.com",
      playtime: 40,
      screenshots: [
        "https://media.rawg.io/media/screenshots/b95/b95ff8ebae956be848f226b86abf63ce.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/b95/b95ff8ebae956be848f226b86abf63ce.jpg",
    },
    external_ids: {
      rawg_id: 9767,
      slug: "hollow-knight",
    },
    community_rating_avg: 4.7,
    community_rating_count: 2800,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "game",
    rawg_id: 4200,
    title: "Portal 2",
    slug: "portal-2",
    cover_url:
      "https://media.rawg.io/media/games/328/32836142d6d30dd453e970edd95738f9.jpg",
    backdrop_url:
      "https://media.rawg.io/media/screenshots/221/221a03d70e5ff9421f92e565607aa4ec.jpg",
    release_date: "2011-04-18",
    year: 2011,
    synopsis:
      "The \"Perpetual Testing Initiative\" has been expanded to allow you to design co-op puzzles for you and your friends! Portal 2 draws from the award-winning formula of innovative gameplay, story, and music that earned the original Portal over 70 industry accolades.",
    genres: ["Puzzle", "Action", "Sci-Fi", "Comedy"],
    type_specific: {
      platforms: ["PC", "Xbox 360", "PlayStation 3", "Nintendo Switch", "Linux", "macOS"],
      platform_played_on: "PC",
      developers: ["Valve Software"],
      publishers: ["Valve"],
      developer: "Valve Software",
      publisher: "Valve",
      genre: "Puzzle Platformer",
      metacritic: 95,
      esrb_rating: "Everyone 10+",
      website: "https://www.thinkwithportals.com",
      playtime: 15,
      screenshots: [
        "https://media.rawg.io/media/screenshots/221/221a03d70e5ff9421f92e565607aa4ec.jpg",
      ],
      backdrop_url:
        "https://media.rawg.io/media/screenshots/221/221a03d70e5ff9421f92e565607aa4ec.jpg",
    },
    external_ids: {
      rawg_id: 4200,
      slug: "portal-2",
    },
    community_rating_avg: 4.9,
    community_rating_count: 5800,
    last_synced_at: new Date().toISOString(),
  },
];

/**
 * Searches games by query string, using RAWG API if RAWG_API_KEY is configured,
 * otherwise falling back to curated mock data.
 */
export async function searchRAWGGames(
  query: string
): Promise<{ results: RAWGGameSearchResult[]; isMock: boolean; error?: string }> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { results: [], isMock: false };

  const { url, headers, apiKeyPresent } = getRAWGFetchConfig("/games", {
    search: query,
    page_size: 15,
    search_precise: "true",
  });

  if (process.env.NODE_ENV !== "development" && (!apiKeyPresent || !url)) {
    throw new Error("RAWG_API_KEY environment variable is not configured");
  }

  if (apiKeyPresent && url) {
    try {
      const res = await fetch(url, {
        headers,
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = await res.json();
        const results: RAWGGameSearchResult[] = (data.results || []).map(
          (g: RAWGGameDetails) => {
            const year = g.released ? new Date(g.released).getFullYear() : null;
            const genres = Array.isArray(g.genres)
              ? g.genres.map((gen) => gen.name)
              : [];
            const platforms = Array.isArray(g.platforms)
              ? g.platforms.map((p) => p.platform?.name).filter(Boolean)
              : [];

            return {
              id: g.id,
              rawg_id: g.id,
              type: "game" as const,
              title: g.name,
              slug: g.slug,
              release_date: g.released,
              year,
              cover_url: g.background_image,
              backdrop_url: g.background_image_additional || g.background_image,
              rating: g.rating,
              ratings_count: g.ratings_count,
              metacritic: g.metacritic,
              genres,
              platforms,
            };
          }
        );
        return { results, isMock: false };
      }

      if (process.env.NODE_ENV !== "development") {
        throw new Error(`RAWG search failed with status ${res.status}`);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "development") {
        throw err instanceof Error ? err : new Error("RAWG search failed");
      }
      // Fall through to mock search in development
    }
  }

  if (process.env.NODE_ENV !== "development") {
    throw new Error("RAWG search failed or RAWG_API_KEY is not configured");
  }

  // Filter Mock Games (development only)
  const filtered = MOCK_GAMES.filter((g) => {
    const titleMatch = g.title.toLowerCase().includes(trimmed);
    const genreMatch = g.genres.some((gen) =>
      gen.toLowerCase().includes(trimmed)
    );
    const devMatch = (g.type_specific.developers || []).some((d) =>
      d.toLowerCase().includes(trimmed)
    );
    return titleMatch || genreMatch || devMatch;
  });

  // If query doesn't match mock directly, provide full mock list so user has instant playable results
  const finalResults = (filtered.length > 0 ? filtered : MOCK_GAMES).map((g) => ({
    id: g.rawg_id,
    rawg_id: g.rawg_id,
    type: "game" as const,
    title: g.title,
    slug: g.slug,
    release_date: g.release_date,
    year: g.year,
    cover_url: g.cover_url,
    backdrop_url: g.backdrop_url,
    rating: g.community_rating_avg,
    ratings_count: g.community_rating_count,
    metacritic: g.type_specific.metacritic,
    genres: g.genres,
    platforms: g.type_specific.platforms,
  }));

  return { results: finalResults, isMock: true };
}

/**
 * Fetches game details by RAWG ID, using the RAWG API if key is configured,
 * otherwise falling back to mock catalog.
 */
export async function fetchRAWGGameDetails(
  id: number | string
): Promise<{ data: RAWGTransformedGame | null; error?: string; isMock: boolean }> {
  const numericId = Number(id);

  // 1. Try Live RAWG API if key present
  const { url, headers, apiKeyPresent } = getRAWGFetchConfig(`/games/${id}`);

  if (process.env.NODE_ENV !== "development" && (!apiKeyPresent || !url)) {
    throw new Error("RAWG_API_KEY environment variable is not configured");
  }

  if (apiKeyPresent && url) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const raw: RAWGGameDetails = await res.json();

        // Also fetch screenshots if available
        let screenshots: string[] = [];
        const { url: ssUrl } = getRAWGFetchConfig(`/games/${id}/screenshots`);
        if (ssUrl) {
          try {
            const ssRes = await fetch(ssUrl, { headers });
            if (ssRes.ok) {
              const ssData = await ssRes.json();
              screenshots = (ssData.results || [])
                .map((s: { image: string }) => s.image)
                .filter(Boolean);
            }
          } catch {
            // Ignore screenshots error
          }
        }

        if (screenshots.length === 0 && raw.short_screenshots) {
          screenshots = raw.short_screenshots.map((s) => s.image).filter(Boolean);
        }

        const genres = Array.isArray(raw.genres)
          ? raw.genres.map((g) => g.name).filter(Boolean)
          : [];
        const platforms = Array.isArray(raw.platforms)
          ? raw.platforms.map((p) => p.platform?.name).filter(Boolean)
          : [];
        const developers = Array.isArray(raw.developers)
          ? raw.developers.map((d) => d.name).filter(Boolean)
          : [];
        const publishers = Array.isArray(raw.publishers)
          ? raw.publishers.map((p) => p.name).filter(Boolean)
          : [];

        const primaryDev = developers[0] || "Unknown Developer";
        const primaryPub = publishers[0] || developers[0] || "Unknown Publisher";
        const primaryGenre = genres[0] || "Video Game";
        const year = raw.released ? new Date(raw.released).getFullYear() : null;

        const transformed: RAWGTransformedGame = {
          type: "game",
          rawg_id: raw.id,
          title: raw.name,
          slug: raw.slug,
          cover_url: raw.background_image || null,
          backdrop_url:
            raw.background_image_additional || raw.background_image || null,
          release_date: raw.released || null,
          year,
          synopsis: raw.description_raw || raw.description || null,
          genres,
          type_specific: {
            platforms,
            platform_played_on: platforms[0] || null,
            developers,
            publishers,
            developer: primaryDev,
            publisher: primaryPub,
            genre: primaryGenre,
            metacritic: raw.metacritic || null,
            esrb_rating: raw.esrb_rating?.name || null,
            website: raw.website || null,
            playtime: raw.playtime || 0,
            screenshots,
            backdrop_url:
              raw.background_image_additional || raw.background_image || null,
          },
          external_ids: {
            rawg_id: raw.id,
            slug: raw.slug,
          },
          community_rating_avg: raw.rating || 0,
          community_rating_count: raw.ratings_count || 0,
          last_synced_at: new Date().toISOString(),
        };

        return { data: transformed, isMock: false };
      }

      if (res.status === 404) {
        return { data: null, error: `Game with ID '${id}' not found`, isMock: false };
      }

      if (process.env.NODE_ENV !== "development") {
        throw new Error(`RAWG details API failed with status ${res.status}`);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "development") {
        throw err instanceof Error ? err : new Error(`RAWG details request failed for ID ${id}`);
      }
      // Fall through to mock in development
    }
  }

  if (process.env.NODE_ENV !== "development") {
    throw new Error(`Game with ID '${id}' not found or RAWG_API_KEY is not configured`);
  }

  // 2. Check in mock games (development only)
  const mockFound = MOCK_GAMES.find(
    (g) => g.rawg_id === numericId || g.slug === String(id)
  );

  if (mockFound) {
    return { data: mockFound, isMock: true };
  }

  // If numeric ID not in mock catalog, return first mock game customized with ID
  if (!isNaN(numericId) && numericId > 0) {
    const fallback = {
      ...MOCK_GAMES[0],
      rawg_id: numericId,
      external_ids: { rawg_id: numericId, slug: MOCK_GAMES[0].slug },
    };
    return { data: fallback, isMock: true };
  }

  return { data: null, error: `Game with ID '${id}' not found`, isMock: true };
}

/**
 * Transforms a RAWGTransformedGame into a Supabase MediaItem format.
 */
export function rawgGameToMediaPayload(game: RAWGTransformedGame): {
  type: "game";
  title: string;
  cover_url: string | null;
  release_date: string | null;
  genres: string[];
  synopsis: string | null;
  type_specific: Json;
  external_ids: Json;
  watch_providers: Json;
  localized_fields: Json;
  community_rating_avg: number;
  community_rating_count: number;
  last_synced_at: string;
} {
  return {
    type: "game",
    title: game.title,
    cover_url: game.cover_url,
    release_date: game.release_date,
    genres: game.genres,
    synopsis: game.synopsis,
    type_specific: game.type_specific as unknown as Json,
    external_ids: game.external_ids as unknown as Json,
    watch_providers: {} as unknown as Json,
    localized_fields: {
      slug: game.slug,
      website: game.type_specific.website,
    } as unknown as Json,
    community_rating_avg: game.community_rating_avg,
    community_rating_count: game.community_rating_count,
    last_synced_at: new Date().toISOString(),
  };
}
