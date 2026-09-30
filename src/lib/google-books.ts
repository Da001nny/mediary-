import type { Json } from "@/types/database.types";

export interface GoogleBookIndustryIdentifier {
  type: string; // "ISBN_10" | "ISBN_13" | "OTHER"
  identifier: string;
}

export interface GoogleBookVolumeInfo {
  title: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: GoogleBookIndustryIdentifier[];
  pageCount?: number;
  printType?: string;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  maturityRating?: string;
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
  language?: string;
  previewLink?: string;
  infoLink?: string;
  canonicalVolumeLink?: string;
  seriesInfo?: {
    volumeNumber?: number;
    bookDisplayNumber?: string;
    seriesId?: string;
  };
}

export interface GoogleBookItem {
  id: string; // Volume ID, e.g. "B1hSG45uGwEC"
  volumeInfo: GoogleBookVolumeInfo;
}

export interface BookSearchResult {
  id: string;
  google_books_id: string;
  type: "book";
  title: string;
  subtitle?: string | null;
  authors: string[];
  author: string;
  publisher?: string | null;
  release_date?: string | null;
  year?: number | null;
  cover_url: string | null;
  page_count: number | null;
  isbn?: string | null;
  series?: string | null;
  genres: string[];
  rating?: number | null;
  ratings_count?: number;
}

export interface TransformedBook {
  type: "book";
  google_books_id: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  release_date: string | null;
  year: number | null;
  synopsis: string | null;
  genres: string[];
  type_specific: {
    author: string;
    authors: string[];
    page_count: number | null;
    edition: string | null;
    isbn: string | null;
    isbn_10: string | null;
    isbn_13: string | null;
    series: string | null;
    publisher: string | null;
    published_date: string | null;
    language: string | null;
    preview_link: string | null;
    info_link: string | null;
  };
  external_ids: {
    google_books_id: string;
    isbn?: string | null;
    isbn_10?: string | null;
    isbn_13?: string | null;
  };
  community_rating_avg: number | null;
  community_rating_count: number;
  last_synced_at: string;
}

const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1/volumes";

/**
 * Normalizes Google Books image URLs to secure HTTPS and optimal resolution.
 */
export function formatBookCoverUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  let formatted = rawUrl.replace(/^http:\/\//i, "https://");
  // Enhance resolution by requesting zoom=1 or zoom=2 instead of tiny thumbnail
  formatted = formatted.replace(/zoom=\d/i, "zoom=1");
  // Remove curl edge artifact if desired for cleaner covers
  formatted = formatted.replace(/&edge=curl/gi, "");
  return formatted;
}

/**
 * Curated high-fidelity mock book library for offline resilience, testing, and instantaneous loading.
 */
export const MOCK_BOOKS: TransformedBook[] = [
  {
    type: "book",
    google_books_id: "B1hSG45uGwEC",
    title: "Dune",
    subtitle: "The Dune Chronicles, Book 1",
    cover_url: "https://books.google.com/books/content?id=B1hSG45uGwEC&printsec=frontcover&img=1&zoom=1",
    release_date: "1965-08-01",
    year: 1965,
    synopsis:
      "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness. A stunning blend of adventure and mysticism, environmentalism and politics, Dune won the first Nebula Award and shared the Hugo Award.",
    genres: ["Science Fiction", "Space Opera", "Classics"],
    type_specific: {
      author: "Frank Herbert",
      authors: ["Frank Herbert"],
      page_count: 412,
      edition: "Ace Science Fiction Deluxe Edition",
      isbn: "9780441013593",
      isbn_10: "0441013597",
      isbn_13: "9780441013593",
      series: "The Dune Chronicles #1",
      publisher: "Ace Books",
      published_date: "1965-08-01",
      language: "en",
      preview_link: "https://books.google.com/books?id=B1hSG45uGwEC",
      info_link: "https://books.google.com/books?id=B1hSG45uGwEC",
    },
    external_ids: {
      google_books_id: "B1hSG45uGwEC",
      isbn: "9780441013593",
      isbn_10: "0441013597",
      isbn_13: "9780441013593",
    },
    community_rating_avg: 4.7,
    community_rating_count: 14200,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "book",
    google_books_id: "r2YdEAAAQBAJ",
    title: "Project Hail Mary",
    subtitle: "A Novel",
    cover_url: "https://books.google.com/books/content?id=r2YdEAAAQBAJ&printsec=frontcover&img=1&zoom=1",
    release_date: "2021-05-04",
    year: 2021,
    synopsis:
      "Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the earth itself are doomed. Except right now, he doesn't know that. He can't even remember his own name, let alone the nature of his assignment or how to complete it. All he knows is that he's been asleep for a very, very long time.",
    genres: ["Science Fiction", "Hard Sci-Fi", "Adventure"],
    type_specific: {
      author: "Andy Weir",
      authors: ["Andy Weir"],
      page_count: 496,
      edition: "First Edition Hardcover",
      isbn: "9780593135204",
      isbn_10: "0593135202",
      isbn_13: "9780593135204",
      series: "Standalone Novel",
      publisher: "Ballantine Books",
      published_date: "2021-05-04",
      language: "en",
      preview_link: "https://books.google.com/books?id=r2YdEAAAQBAJ",
      info_link: "https://books.google.com/books?id=r2YdEAAAQBAJ",
    },
    external_ids: {
      google_books_id: "r2YdEAAAQBAJ",
      isbn: "9780593135204",
      isbn_10: "0593135202",
      isbn_13: "9780593135204",
    },
    community_rating_avg: 4.8,
    community_rating_count: 8900,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "book",
    google_books_id: "3rY5EAAAQBAJ",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    subtitle: "A Novel",
    cover_url: "https://books.google.com/books/content?id=3rY5EAAAQBAJ&printsec=frontcover&img=1&zoom=1",
    release_date: "2022-07-05",
    year: 2022,
    synopsis:
      "On a bitter-cold day, in the December of his junior year at Harvard, Sam Masur exits a subway car and sees, amid the hordes of people waiting on the platform, Sadie Green. He calls her name. For a moment, she pretends she hasn't heard him, but then she turns, and a game begins: a legendary collaboration that will launch them to stardom.",
    genres: ["Literary Fiction", "Video Games", "Drama"],
    type_specific: {
      author: "Gabrielle Zevin",
      authors: ["Gabrielle Zevin"],
      page_count: 416,
      edition: "Knopf Hardcover",
      isbn: "9780593321201",
      isbn_10: "0593321200",
      isbn_13: "9780593321201",
      series: "Standalone Novel",
      publisher: "Knopf",
      published_date: "2022-07-05",
      language: "en",
      preview_link: "https://books.google.com/books?id=3rY5EAAAQBAJ",
      info_link: "https://books.google.com/books?id=3rY5EAAAQBAJ",
    },
    external_ids: {
      google_books_id: "3rY5EAAAQBAJ",
      isbn: "9780593321201",
      isbn_10: "0593321200",
      isbn_13: "9780593321201",
    },
    community_rating_avg: 4.6,
    community_rating_count: 6500,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "book",
    google_books_id: "pD6arNyKyi8C",
    title: "The Hobbit",
    subtitle: "Or There and Back Again",
    cover_url: "https://books.google.com/books/content?id=pD6arNyKyi8C&printsec=frontcover&img=1&zoom=1",
    release_date: "1937-09-21",
    year: 1937,
    synopsis:
      "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life, rarely traveling any farther than his pantry or cellar. But his contentment is disturbed when the wizard Gandalf and a company of thirteen dwarves arrive on his doorstep to whisk him away on an epic journey to raid the treasure hoard guarded by Smaug the Dragon.",
    genres: ["Fantasy", "Classics", "Adventure"],
    type_specific: {
      author: "J.R.R. Tolkien",
      authors: ["J.R.R. Tolkien"],
      page_count: 310,
      edition: "75th Anniversary Edition",
      isbn: "9780547928227",
      isbn_10: "054792822X",
      isbn_13: "9780547928227",
      series: "Middle-earth Universe",
      publisher: "Houghton Mifflin Harcourt",
      published_date: "1937-09-21",
      language: "en",
      preview_link: "https://books.google.com/books?id=pD6arNyKyi8C",
      info_link: "https://books.google.com/books?id=pD6arNyKyi8C",
    },
    external_ids: {
      google_books_id: "pD6arNyKyi8C",
      isbn: "9780547928227",
      isbn_10: "054792822X",
      isbn_13: "9780547928227",
    },
    community_rating_avg: 4.8,
    community_rating_count: 22000,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "book",
    google_books_id: "fFCjDQAAQBAJ",
    title: "Atomic Habits",
    subtitle: "An Easy & Proven Way to Build Good Habits & Break Bad Ones",
    cover_url: "https://books.google.com/books/content?id=fFCjDQAAQBAJ&printsec=frontcover&img=1&zoom=1",
    release_date: "2018-10-16",
    year: 2018,
    synopsis:
      "No matter your goals, Atomic Habits offers a proven framework for improving—every day. James Clear, one of the world's leading experts on habit formation, reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.",
    genres: ["Self-Help", "Psychology", "Personal Growth"],
    type_specific: {
      author: "James Clear",
      authors: ["James Clear"],
      page_count: 320,
      edition: "First Edition Hardcover",
      isbn: "9780735211292",
      isbn_10: "0735211299",
      isbn_13: "9780735211292",
      series: "Non-Fiction",
      publisher: "Avery",
      published_date: "2018-10-16",
      language: "en",
      preview_link: "https://books.google.com/books?id=fFCjDQAAQBAJ",
      info_link: "https://books.google.com/books?id=fFCjDQAAQBAJ",
    },
    external_ids: {
      google_books_id: "fFCjDQAAQBAJ",
      isbn: "9780735211292",
      isbn_10: "0735211299",
      isbn_13: "9780735211292",
    },
    community_rating_avg: 4.9,
    community_rating_count: 31000,
    last_synced_at: new Date().toISOString(),
  },
  {
    type: "book",
    google_books_id: "kot1DwAAQBAJ",
    title: "1984",
    subtitle: "A Dystopian Classic",
    cover_url: "https://books.google.com/books/content?id=kot1DwAAQBAJ&printsec=frontcover&img=1&zoom=1",
    release_date: "1949-06-08",
    year: 1949,
    synopsis:
      "Winston Smith toes the Party line, rewriting history to satisfy the Ministry of Truth. With every lie he writes, Winston grows to hate the Party that seeks power for its own sake and persecutes those who dare to commit thoughtcrime. But as he begins to think for himself, Winston cannot escape the fact that Big Brother is always watching.",
    genres: ["Classics", "Dystopian", "Political Fiction"],
    type_specific: {
      author: "George Orwell",
      authors: ["George Orwell"],
      page_count: 328,
      edition: "Signet Classic",
      isbn: "9780451524935",
      isbn_10: "0451524934",
      isbn_13: "9780451524935",
      series: "Classics",
      publisher: "Signet",
      published_date: "1949-06-08",
      language: "en",
      preview_link: "https://books.google.com/books?id=kot1DwAAQBAJ",
      info_link: "https://books.google.com/books?id=kot1DwAAQBAJ",
    },
    external_ids: {
      google_books_id: "kot1DwAAQBAJ",
      isbn: "9780451524935",
      isbn_10: "0451524934",
      isbn_13: "9780451524935",
    },
    community_rating_avg: 4.7,
    community_rating_count: 28000,
    last_synced_at: new Date().toISOString(),
  },
];

/**
 * Searches Google Books API for books matching a query string.
 * Falls back to curated mock data if offline or no results found.
 */
export async function searchGoogleBooks(
  query: string
): Promise<{ results: BookSearchResult[]; isMock: boolean; error?: string }> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { results: [], isMock: false };

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  const url = new URL(GOOGLE_BOOKS_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "15");
  url.searchParams.set("printType", "books");

  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      const items: GoogleBookItem[] = Array.isArray(data.items) ? data.items : [];

      if (items.length > 0) {
        const results: BookSearchResult[] = items.map((b) => {
          const v = b.volumeInfo || {};
          const authors = Array.isArray(v.authors) ? v.authors : ["Unknown Author"];
          const primaryAuthor = authors[0];
          const year = v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) || null : null;
          const cover =
            formatBookCoverUrl(v.imageLinks?.thumbnail) ||
            formatBookCoverUrl(v.imageLinks?.smallThumbnail) ||
            null;

          const isbn13 = v.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier;
          const isbn10 = v.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier;

          return {
            id: b.id,
            google_books_id: b.id,
            type: "book" as const,
            title: v.title || "Untitled Book",
            subtitle: v.subtitle || null,
            authors,
            author: primaryAuthor,
            publisher: v.publisher || null,
            release_date: v.publishedDate || null,
            year,
            cover_url: cover,
            page_count: v.pageCount || null,
            isbn: isbn13 || isbn10 || null,
            series: v.subtitle || null,
            genres: Array.isArray(v.categories) ? v.categories : ["Literature"],
            rating: v.averageRating || null,
            ratings_count: v.ratingsCount || 0,
          };
        });

        return { results, isMock: false };
      }
    }
  } catch {
    // Fall through to mock search
  }

  // Filter Mock Books
  const filtered = MOCK_BOOKS.filter((b) => {
    const titleMatch = b.title.toLowerCase().includes(trimmed);
    const authorMatch = b.type_specific.authors.some((a) => a.toLowerCase().includes(trimmed));
    const genreMatch = b.genres.some((g) => g.toLowerCase().includes(trimmed));
    return titleMatch || authorMatch || genreMatch;
  });

  const finalMock = (filtered.length > 0 ? filtered : MOCK_BOOKS).map((b) => ({
    id: b.google_books_id,
    google_books_id: b.google_books_id,
    type: "book" as const,
    title: b.title,
    subtitle: b.subtitle,
    authors: b.type_specific.authors,
    author: b.type_specific.author,
    publisher: b.type_specific.publisher,
    release_date: b.release_date,
    year: b.year,
    cover_url: b.cover_url,
    page_count: b.type_specific.page_count,
    isbn: b.type_specific.isbn,
    series: b.type_specific.series,
    genres: b.genres,
    rating: b.community_rating_avg,
    ratings_count: b.community_rating_count,
  }));

  return { results: finalMock, isMock: true };
}

/**
 * Fetches single volume details from Google Books API by Volume ID or fallback mock.
 */
export async function fetchGoogleBookDetails(
  id: string
): Promise<{ data: TransformedBook | null; error?: string; isMock: boolean }> {
  const cleanId = id.replace(/^(book-|gb-)/i, "");

  // 1. Try Live API
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  const url = new URL(`${GOOGLE_BOOKS_BASE_URL}/${cleanId}`);
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const b: GoogleBookItem = await res.json();
      const v = b.volumeInfo || {};
      const authors = Array.isArray(v.authors) ? v.authors : ["Unknown Author"];
      const primaryAuthor = authors[0];
      const year = v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) || null : null;
      const cover =
        formatBookCoverUrl(v.imageLinks?.extraLarge) ||
        formatBookCoverUrl(v.imageLinks?.large) ||
        formatBookCoverUrl(v.imageLinks?.medium) ||
        formatBookCoverUrl(v.imageLinks?.thumbnail) ||
        formatBookCoverUrl(v.imageLinks?.smallThumbnail) ||
        null;

      const isbn13 = v.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier || null;
      const isbn10 = v.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier || null;
      const primaryIsbn = isbn13 || isbn10 || null;

      const genres = Array.isArray(v.categories) ? v.categories : ["Literature"];
      const series = v.subtitle || (v.seriesInfo?.seriesId ? `Series ${v.seriesInfo.seriesId}` : null);

      const transformed: TransformedBook = {
        type: "book",
        google_books_id: b.id,
        title: v.title || "Untitled Book",
        subtitle: v.subtitle || null,
        cover_url: cover,
        release_date: v.publishedDate || null,
        year,
        synopsis: v.description || null,
        genres,
        type_specific: {
          author: primaryAuthor,
          authors,
          page_count: v.pageCount || null,
          edition: v.publisher ? `${v.publisher} Edition` : null,
          isbn: primaryIsbn,
          isbn_10: isbn10,
          isbn_13: isbn13,
          series,
          publisher: v.publisher || null,
          published_date: v.publishedDate || null,
          language: v.language || "en",
          preview_link: v.previewLink || null,
          info_link: v.infoLink || null,
        },
        external_ids: {
          google_books_id: b.id,
          isbn: primaryIsbn,
          isbn_10: isbn10,
          isbn_13: isbn13,
        },
        community_rating_avg: v.averageRating || null,
        community_rating_count: v.ratingsCount || 0,
        last_synced_at: new Date().toISOString(),
      };

      return { data: transformed, isMock: false };
    }
  } catch {
    // Fallback to mock
  }

  // 2. Check in mock catalog
  const found = MOCK_BOOKS.find(
    (b) =>
      b.google_books_id === cleanId ||
      b.type_specific.isbn === cleanId ||
      b.type_specific.isbn_13 === cleanId
  );

  if (found) {
    return { data: found, isMock: true };
  }

  // Return Dune as customized fallback if ID provided
  if (cleanId) {
    const fallback: TransformedBook = {
      ...MOCK_BOOKS[0],
      google_books_id: cleanId,
      external_ids: { ...MOCK_BOOKS[0].external_ids, google_books_id: cleanId },
    };
    return { data: fallback, isMock: true };
  }

  return { data: null, error: `Book with ID '${id}' not found`, isMock: true };
}

/**
 * Transforms TransformedBook into payload matching public.media table schema.
 */
export function bookToMediaPayload(book: TransformedBook): {
  type: "book";
  title: string;
  cover_url: string | null;
  release_date: string | null;
  genres: string[];
  synopsis: string | null;
  type_specific: Json;
  external_ids: Json;
  watch_providers: Json;
  localized_fields: Json;
  community_rating_avg: number | null;
  community_rating_count: number;
  last_synced_at: string;
} {
  return {
    type: "book",
    title: book.title,
    cover_url: book.cover_url,
    release_date: book.release_date,
    genres: book.genres,
    synopsis: book.synopsis,
    type_specific: book.type_specific as unknown as Json,
    external_ids: book.external_ids as unknown as Json,
    watch_providers: {} as unknown as Json,
    localized_fields: {
      subtitle: book.subtitle,
      author: book.type_specific.author,
      publisher: book.type_specific.publisher,
      isbn: book.type_specific.isbn,
    } as unknown as Json,
    community_rating_avg: book.community_rating_avg,
    community_rating_count: book.community_rating_count,
    last_synced_at: new Date().toISOString(),
  };
}
