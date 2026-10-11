import Papa from "papaparse";
import JSZip from "jszip";

export type ImportSource = "letterboxd" | "goodreads";
export type ImportVisibilityChoice = "private" | "friends" | "public" | "default";

export interface ParsedImportItem {
  source: ImportSource;
  title: string;
  year: number | null;
  author?: string | null;
  letterboxd_uri?: string | null;
  isbn13?: string | null;
  isbn10?: string | null;
  rating: number | null; // 0-100
  review: string | null; // capped at 10,000 chars plain text
  contains_spoilers: boolean;
  status: "completed" | "in_progress" | "planned" | "dropped";
  completed_at: string | null; // ISO string
  created_at?: string | null;
}

export interface ImportPreviewSummary {
  source: ImportSource;
  total: number;
  breakdown: string;
  items: ParsedImportItem[];
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_ROWS = 5000;

const KNOWN_LETTERBOXD_FILES = new Set([
  "ratings.csv",
  "reviews.csv",
  "diary.csv",
  "watched.csv",
  "watchlist.csv",
]);

/**
 * Strips HTML tags, trims, decodes simple entities, and caps length at maxLen characters.
 */
export function cleanPlainText(val: unknown, maxLen = 10000): string | null {
  if (typeof val !== "string") return null;
  let text = val.trim();
  if (!text) return null;

  // Replace HTML breaks/paragraphs with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Unescape standard HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  text = text.trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

/**
 * Safely parses varied date formats into an ISO timestamp string.
 */
export function parseDateSafe(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const str = val.trim();
  if (!str) return null;

  // Standard YYYY-MM-DD or YYYY/MM/DD
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString();
  }
  return null;
}

/**
 * Strips the ="..." wrapper Goodreads puts around ISBN values and cleans non-digit characters.
 */
export function stripGoodreadsIsbn(val: unknown): string | null {
  if (!val) return null;
  let str = String(val).trim();
  if (!str) return null;

  // Remove ="..." wrapper
  str = str.replace(/^="?|"?$/g, "");
  // Keep only digits and 'X'/'x'
  str = str.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (!str) return null;
  return str;
}

/**
 * Helper to parse a CSV text string into an array of objects with normalized lowercase trimmed headers.
 */
export function parseCsvText<T = Record<string, string>>(csvText: string): T[] {
  const parsed = Papa.parse<T>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });
  return (parsed.data || []) as T[];
}

/**
 * Parses Letterboxd exports from a ZIP file or individual CSV files.
 */
export async function parseLetterboxdFiles(
  files: File[]
): Promise<ImportPreviewSummary> {
  if (!files || files.length === 0) {
    throw new Error("No files selected for Letterboxd import.");
  }

  // Validate file sizes
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      throw new Error(`File "${f.name}" exceeds the 20 MB size limit.`);
    }
  }

  const csvMap = new Map<string, string>();

  // Check if a single ZIP file was provided
  const zipFile = files.find(
    (f) =>
      f.name.toLowerCase().endsWith(".zip") ||
      f.type === "application/zip" ||
      f.type === "application/x-zip-compressed"
  );

  if (zipFile) {
    const zip = await JSZip.loadAsync(zipFile);
    for (const [filename, fileObj] of Object.entries(zip.files)) {
      if (fileObj.dir) continue;
      // Strip any directory path from filename
      const baseName = filename.split("/").pop()?.toLowerCase();
      if (baseName && KNOWN_LETTERBOXD_FILES.has(baseName)) {
        const text = await fileObj.async("string");
        csvMap.set(baseName, text);
      }
    }
  } else {
    // Process individual CSV files
    for (const f of files) {
      const baseName = f.name.toLowerCase();
      if (KNOWN_LETTERBOXD_FILES.has(baseName)) {
        const text = await f.text();
        csvMap.set(baseName, text);
      }
    }
  }

  if (csvMap.size === 0) {
    throw new Error(
      "No valid Letterboxd export files found. Please upload the export ZIP or CSVs: ratings.csv, reviews.csv, diary.csv, watched.csv, watchlist.csv."
    );
  }

  // Temporary aggregation map keyed by Letterboxd URI (or title + year)
  interface LetterboxdAgg {
    uri: string | null;
    title: string;
    year: number | null;
    ratings: number[];
    reviews: string[];
    watchedDates: string[];
    isWatchlistOnly: boolean;
    hasWatchedStatus: boolean;
    containsSpoilers: boolean;
  }

  const filmMap = new Map<string, LetterboxdAgg>();

  const getAgg = (
    rawTitle: string,
    rawYear: unknown,
    rawUri: unknown
  ): LetterboxdAgg | null => {
    const title = String(rawTitle || "").trim();
    if (!title) return null;

    let year: number | null = null;
    if (rawYear) {
      const parsedYear = parseInt(String(rawYear).trim(), 10);
      if (!isNaN(parsedYear) && parsedYear > 1850 && parsedYear < 2100) {
        year = parsedYear;
      }
    }

    const uri = typeof rawUri === "string" && rawUri.trim() ? rawUri.trim() : null;
    const key = uri || `${title.toLowerCase()}___${year || ""}`;

    let existing = filmMap.get(key);
    if (!existing) {
      existing = {
        uri,
        title,
        year,
        ratings: [],
        reviews: [],
        watchedDates: [],
        isWatchlistOnly: true,
        hasWatchedStatus: false,
        containsSpoilers: false,
      };
      filmMap.set(key, existing);
    }
    return existing;
  };

  // 1. watched.csv: Date, Name, Year, Letterboxd URI
  if (csvMap.has("watched.csv")) {
    const rows = parseCsvText<Record<string, string>>(csvMap.get("watched.csv")!);
    for (const r of rows) {
      const agg = getAgg(r.name || r.title, r.year, r["letterboxd uri"] || r.uri);
      if (!agg) continue;
      agg.isWatchlistOnly = false;
      agg.hasWatchedStatus = true;
      const d = parseDateSafe(r.date);
      if (d) agg.watchedDates.push(d);
    }
  }

  // 2. ratings.csv: Date, Name, Year, Letterboxd URI, Rating
  if (csvMap.has("ratings.csv")) {
    const rows = parseCsvText<Record<string, string>>(csvMap.get("ratings.csv")!);
    for (const r of rows) {
      const agg = getAgg(r.name || r.title, r.year, r["letterboxd uri"] || r.uri);
      if (!agg) continue;
      agg.isWatchlistOnly = false;
      agg.hasWatchedStatus = true;
      const d = parseDateSafe(r.date);
      if (d) agg.watchedDates.push(d);
      if (r.rating) {
        const num = parseFloat(r.rating);
        if (!isNaN(num) && num >= 0.5 && num <= 5.0) {
          agg.ratings.push(Math.round(num * 20));
        }
      }
    }
  }

  // 3. diary.csv: Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
  if (csvMap.has("diary.csv")) {
    const rows = parseCsvText<Record<string, string>>(csvMap.get("diary.csv")!);
    for (const r of rows) {
      const agg = getAgg(r.name || r.title, r.year, r["letterboxd uri"] || r.uri);
      if (!agg) continue;
      agg.isWatchlistOnly = false;
      agg.hasWatchedStatus = true;
      const d = parseDateSafe(r["watched date"] || r.date);
      if (d) agg.watchedDates.push(d);
      if (r.rating) {
        const num = parseFloat(r.rating);
        if (!isNaN(num) && num >= 0.5 && num <= 5.0) {
          agg.ratings.push(Math.round(num * 20));
        }
      }
    }
  }

  // 4. reviews.csv: Date, Name, Year, Letterboxd URI, Rating, Rewatch, Review, Tags, Watched Date, Spoiler
  if (csvMap.has("reviews.csv")) {
    const rows = parseCsvText<Record<string, string>>(csvMap.get("reviews.csv")!);
    for (const r of rows) {
      const agg = getAgg(r.name || r.title, r.year, r["letterboxd uri"] || r.uri);
      if (!agg) continue;
      agg.isWatchlistOnly = false;
      agg.hasWatchedStatus = true;
      const d = parseDateSafe(r["watched date"] || r.date);
      if (d) agg.watchedDates.push(d);
      if (r.rating) {
        const num = parseFloat(r.rating);
        if (!isNaN(num) && num >= 0.5 && num <= 5.0) {
          agg.ratings.push(Math.round(num * 20));
        }
      }
      const reviewText = cleanPlainText(r.review);
      if (reviewText) {
        agg.reviews.push(reviewText);
      }
      if (r.spoiler && String(r.spoiler).toLowerCase() === "true") {
        agg.containsSpoilers = true;
      }
    }
  }

  // 5. watchlist.csv: Date, Name, Year, Letterboxd URI
  if (csvMap.has("watchlist.csv")) {
    const rows = parseCsvText<Record<string, string>>(csvMap.get("watchlist.csv")!);
    for (const r of rows) {
      const agg = getAgg(r.name || r.title, r.year, r["letterboxd uri"] || r.uri);
      if (!agg) continue;
      // Note: isWatchlistOnly remains true ONLY if not seen in any watched/rating/review file
    }
  }

  if (filmMap.size > MAX_ROWS) {
    throw new Error(
      `Export contains ${filmMap.size} films, which exceeds the limit of ${MAX_ROWS} rows per import job.`
    );
  }

  let ratedCount = 0;
  let reviewedCount = 0;
  let watchlistCount = 0;

  const items: ParsedImportItem[] = [];

  for (const agg of filmMap.values()) {
    // Determine rating: use latest or highest
    const rating = agg.ratings.length > 0 ? agg.ratings[agg.ratings.length - 1] : null;
    if (rating !== null) ratedCount++;

    // Determine review
    const review = agg.reviews.length > 0 ? agg.reviews[agg.reviews.length - 1] : null;
    if (review !== null) reviewedCount++;

    // Determine status
    let status: "completed" | "planned" = "completed";
    if (agg.isWatchlistOnly) {
      status = "planned";
      watchlistCount++;
    }

    // Determine latest watched date
    let completedAt: string | null = null;
    if (agg.watchedDates.length > 0) {
      // Sort ISO date strings in ascending order, pick latest
      agg.watchedDates.sort();
      completedAt = agg.watchedDates[agg.watchedDates.length - 1];
    }

    items.push({
      source: "letterboxd",
      title: agg.title,
      year: agg.year,
      letterboxd_uri: agg.uri,
      rating,
      review,
      contains_spoilers: agg.containsSpoilers,
      status,
      completed_at: completedAt,
      created_at: completedAt || undefined,
    });
  }

  const breakdown = `${items.length} films: ${ratedCount} rated, ${reviewedCount} reviewed, ${watchlistCount} on your watchlist`;

  return {
    source: "letterboxd",
    total: items.length,
    breakdown,
    items,
  };
}

/**
 * Parses Goodreads goodreads_library_export.csv.
 */
export async function parseGoodreadsFile(file: File): Promise<ImportPreviewSummary> {
  if (!file) {
    throw new Error("No file selected for Goodreads import.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File "${file.name}" exceeds the 20 MB size limit.`);
  }

  const text = await file.text();
  const rows = parseCsvText<Record<string, string>>(text);

  if (rows.length === 0) {
    throw new Error("The Goodreads export file appears to be empty.");
  }

  // Validate that it looks like a Goodreads export
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const hasBookIdOrTitle = keys.some(
    (k) => k.includes("book id") || k.includes("title") || k.includes("exclusive shelf")
  );

  if (!hasBookIdOrTitle) {
    throw new Error(
      "Unrecognized file format. Expected a Goodreads library export CSV (goodreads_library_export.csv)."
    );
  }

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `Export contains ${rows.length} books, which exceeds the limit of ${MAX_ROWS} rows per import job.`
    );
  }

  let readCount = 0;
  let ratedCount = 0;
  let toReadCount = 0;

  const items: ParsedImportItem[] = [];

  for (const r of rows) {
    const rawTitle = r.title || r["book title"];
    if (!rawTitle || !rawTitle.trim()) continue;

    const title = rawTitle.trim();
    const author = r.author ? r.author.trim() : null;

    // Publication Year
    let year: number | null = null;
    const rawYear = r["original publication year"] || r["year published"];
    if (rawYear) {
      const parsedYear = parseInt(String(rawYear).trim(), 10);
      if (!isNaN(parsedYear) && parsedYear > 1000 && parsedYear < 2100) {
        year = parsedYear;
      }
    }

    // ISBNs
    const isbn13 = stripGoodreadsIsbn(r.isbn13);
    const isbn10 = stripGoodreadsIsbn(r.isbn);

    // Exclusive Shelf mapping:
    // read -> completed, currently-reading -> in_progress, to-read -> planned
    const shelf = (r["exclusive shelf"] || "").toLowerCase().trim();
    let status: "completed" | "in_progress" | "planned" | "dropped" = "completed";

    if (shelf === "currently-reading") {
      status = "in_progress";
    } else if (shelf === "to-read") {
      status = "planned";
      toReadCount++;
    } else if (shelf === "read") {
      status = "completed";
      readCount++;
    } else if (shelf === "did-not-finish" || shelf === "abandoned") {
      status = "dropped";
    } else {
      status = "completed";
      readCount++;
    }

    // My Rating: 1-5 multiplies by 20, 0 means unrated (null)
    let rating: number | null = null;
    if (r["my rating"]) {
      const parsedRating = parseInt(String(r["my rating"]).trim(), 10);
      if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
        rating = parsedRating * 20;
        ratedCount++;
      }
    }

    // Date Read becomes completed_at
    const completedAt = parseDateSafe(r["date read"]);

    // My Review becomes review (Never import Private Notes!)
    const review = cleanPlainText(r["my review"]);

    // Spoilers
    const rawSpoiler = r.spoiler || r.spoilers;
    const containsSpoilers = Boolean(
      rawSpoiler &&
        String(rawSpoiler).trim().length > 0 &&
        String(rawSpoiler).toLowerCase() !== "false" &&
        String(rawSpoiler).toLowerCase() !== "0"
    );

    items.push({
      source: "goodreads",
      title,
      author,
      year,
      isbn13,
      isbn10,
      rating,
      review,
      contains_spoilers: containsSpoilers,
      status,
      completed_at: completedAt,
      created_at: completedAt || undefined,
    });
  }

  const breakdown = `${items.length} books: ${readCount} read, ${ratedCount} rated, ${toReadCount} to-read`;

  return {
    source: "goodreads",
    total: items.length,
    breakdown,
    items,
  };
}
