import { NextRequest, NextResponse } from "next/server";
import { syncGoogleBookToMedia } from "@/lib/import-service";

export const maxDuration = 60;

interface SeedBook {
  title: string;
  author: string;
}

const SEED_BOOKS: readonly SeedBook[] = [
  { title: "Dune", author: "Frank Herbert" },
  { title: "Project Hail Mary", author: "Andy Weir" },
  { title: "The Martian", author: "Andy Weir" },
  { title: "Atomic Habits", author: "James Clear" },
  { title: "Sapiens", author: "Yuval Noah Harari" },
  { title: "The Hobbit", author: "J.R.R. Tolkien" },
  { title: "The Fellowship of the Ring", author: "J.R.R. Tolkien" },
  { title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling" },
  { title: "1984", author: "George Orwell" },
  { title: "Brave New World", author: "Aldous Huxley" },
  { title: "To Kill a Mockingbird", author: "Harper Lee" },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  { title: "Pride and Prejudice", author: "Jane Austen" },
  { title: "The Catcher in the Rye", author: "J.D. Salinger" },
  { title: "Fahrenheit 451", author: "Ray Bradbury" },
  { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams" },
  { title: "Neuromancer", author: "William Gibson" },
  { title: "Ender's Game", author: "Orson Scott Card" },
  { title: "Foundation", author: "Isaac Asimov" },
  { title: "The Name of the Wind", author: "Patrick Rothfuss" },
  { title: "A Game of Thrones", author: "George R. R. Martin" },
  { title: "The Hunger Games", author: "Suzanne Collins" },
  { title: "Gone Girl", author: "Gillian Flynn" },
  { title: "The Da Vinci Code", author: "Dan Brown" },
  { title: "Educated", author: "Tara Westover" },
  { title: "Becoming", author: "Michelle Obama" },
  { title: "The Alchemist", author: "Paulo Coelho" },
  { title: "One Hundred Years of Solitude", author: "Gabriel Garcia Marquez" },
  { title: "Crime and Punishment", author: "Fyodor Dostoevsky" },
  { title: "Frankenstein", author: "Mary Shelley" },
  { title: "Dracula", author: "Bram Stoker" },
  { title: "The Shining", author: "Stephen King" },
  { title: "Normal People", author: "Sally Rooney" },
  { title: "The Midnight Library", author: "Matt Haig" },
  { title: "Where the Crawdads Sing", author: "Delia Owens" },
  { title: "Station Eleven", author: "Emily St. John Mandel" },
  { title: "The Road", author: "Cormac McCarthy" },
  { title: "Klara and the Sun", author: "Kazuo Ishiguro" },
  { title: "Thinking, Fast and Slow", author: "Daniel Kahneman" },
  { title: "Cosmos", author: "Carl Sagan" },
  { title: "A Brief History of Time", author: "Stephen Hawking" },
  { title: "Meditations", author: "Marcus Aurelius" },
];

/**
 * Normalizes title for matching:
 * lowercase, no punctuation, no leading "the".
 */
function normalizeTitle(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}

interface GoogleBookItem {
  id: string;
  volumeInfo?: {
    title?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
  };
}

function hasCoverImage(item: GoogleBookItem): boolean {
  const images = item.volumeInfo?.imageLinks;
  if (!images) return false;
  return Boolean(
    images.thumbnail ||
      images.smallThumbnail ||
      images.small ||
      images.medium ||
      images.large ||
      images.extraLarge
  );
}

export async function GET(req: NextRequest) {
  // 1. Authorization check
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET is missing or empty" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse offset and limit
  const { searchParams } = new URL(req.url);
  const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "15", 10);

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) || rawLimit <= 0 ? 15 : rawLimit;

  const slice = SEED_BOOKS.slice(offset, offset + limit);

  let synced = 0;
  const skipped: string[] = [];
  const failed: Array<{ title: string; error: string }> = [];

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();

  // 3. Process each book in slice
  for (const book of slice) {
    try {
      const wantedNormalized = normalizeTitle(book.title);

      const url = new URL("https://www.googleapis.com/books/v1/volumes");
      url.searchParams.set("q", `intitle:"${book.title}" inauthor:"${book.author}"`);
      url.searchParams.set("printType", "books");
      url.searchParams.set("maxResults", "5");
      if (apiKey) {
        url.searchParams.set("key", apiKey);
      }

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Google Books API HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const items: GoogleBookItem[] = Array.isArray(data.items) ? data.items : [];

      let matchedItem: GoogleBookItem | null = null;
      for (const item of items) {
        const candidateTitle = item.volumeInfo?.title || "";
        const candidateNormalized = normalizeTitle(candidateTitle);
        if (candidateNormalized.startsWith(wantedNormalized) && hasCoverImage(item)) {
          matchedItem = item;
          break;
        }
      }

      if (!matchedItem) {
        skipped.push(book.title);
        continue;
      }

      await syncGoogleBookToMedia(matchedItem.id);
      synced++;
    } catch (err) {
      failed.push({
        title: book.title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    processed: slice.length,
    synced,
    skipped,
    failed,
  });
}
