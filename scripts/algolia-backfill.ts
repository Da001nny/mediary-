/**
 * meDiary Algolia One-Time Backfill CLI Script
 *
 * Usage:
 *   npx tsx scripts/algolia-backfill.ts
 *   or:
 *   npm run algolia:backfill
 */

import { algoliasearch } from "algoliasearch";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// 1. Manually parse .env.local or .env if present
function loadEnvFile(filename: string) {
  const fullPath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

async function main() {
  console.log("=================================================");
  console.log("🚀 meDiary — Algolia One-Time Catalog Backfill");
  console.log("=================================================");

  const appId =
    process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const adminKey =
    process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_API_KEY;
  const indexName =
    process.env.ALGOLIA_INDEX_NAME ||
    process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME ||
    "media";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!appId || !adminKey) {
    console.error("❌ Error: Missing Algolia credentials.");
    console.error(
      "   Please set ALGOLIA_APP_ID (or NEXT_PUBLIC_ALGOLIA_APP_ID) and ALGOLIA_ADMIN_API_KEY in .env.local or environment variables."
    );
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing Supabase credentials.");
    console.error(
      "   Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or environment variables."
    );
    process.exit(1);
  }

  console.log(`📌 Target Algolia Index: '${indexName}'`);
  console.log(`📌 Algolia App ID:       '${appId}'`);
  console.log(`📌 Supabase URL:        '${supabaseUrl}'`);
  console.log("");

  // 1. Initialize Supabase
  console.log("🔍 Fetching all records from Supabase 'public.media' table...");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: mediaItems, error } = await supabase
    .from("media")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Failed to query media table from Supabase:", error.message);
    process.exit(1);
  }

  const items = mediaItems || [];
  console.log(`✅ Retrieved ${items.length} records from database.`);

  if (items.length === 0) {
    console.log("⚠️ No records found in 'media' table to backfill.");
    process.exit(0);
  }

  // 2. Format records for Algolia
  console.log("⚙️ Formatting media items for Algolia schema...");
  const records = items.map((rawItem: unknown) => {
    const m = rawItem as Record<string, unknown>;
    let year: number | null = null;
    if (m.release_date && typeof m.release_date === "string") {
      const y = parseInt(m.release_date.slice(0, 4), 10);
      if (!isNaN(y)) year = y;
    }

    const typeSpecific = (m.type_specific || {}) as Record<string, unknown>;

    return {
      objectID: String(m.id),
      id: String(m.id),
      type: m.type as string,
      title: m.title as string,
      cover_url: (m.cover_url as string) || null,
      release_date: (m.release_date as string) || null,
      year,
      genres: Array.isArray(m.genres) ? (m.genres as string[]) : [],
      synopsis: (m.synopsis as string) || null,
      community_rating_avg: (m.community_rating_avg as number) ?? null,
      community_rating_count: (m.community_rating_count as number) ?? 0,
      author: typeof typeSpecific.author === "string" ? typeSpecific.author : null,
      director: typeof typeSpecific.director === "string" ? typeSpecific.director : null,
      developer: typeof typeSpecific.developer === "string" ? typeSpecific.developer : null,
      developers: Array.isArray(typeSpecific.developers)
        ? (typeSpecific.developers as string[])
        : typeof typeSpecific.developer === "string"
        ? [typeSpecific.developer]
        : [],
      publisher: typeof typeSpecific.publisher === "string" ? typeSpecific.publisher : null,
      publishers: Array.isArray(typeSpecific.publishers)
        ? (typeSpecific.publishers as string[])
        : typeof typeSpecific.publisher === "string"
        ? [typeSpecific.publisher]
        : [],
      platforms: Array.isArray(typeSpecific.platforms) ? (typeSpecific.platforms as string[]) : [],
      external_ids: (m.external_ids as Record<string, unknown>) || {},
      last_synced_at: (m.last_synced_at as string) || new Date().toISOString(),
    };
  });

  // 3. Connect to Algolia
  console.log("📡 Initializing Algolia admin client...");
  const client = algoliasearch(appId, adminKey);

  // 4. Configure Index Settings
  console.log("🔧 Configuring index settings (searchableAttributes, customRanking, faceting)...");
  try {
    await client.setSettings({
      indexName,
      indexSettings: {
        searchableAttributes: [
          "title",
          "unordered(genres)",
          "author",
          "director",
          "developer",
          "developers",
          "publisher",
          "publishers",
          "platforms",
          "synopsis",
        ],
        attributesForFaceting: [
          "filterOnly(type)",
          "genres",
          "year",
          "platforms",
          "publisher",
          "developer",
        ],
        customRanking: [
          "desc(community_rating_count)",
          "desc(community_rating_avg)",
          "desc(year)",
        ],
        typoTolerance: true,
        minWordSizefor1Typo: 4,
        minWordSizefor2Typos: 8,
      },
    });
    console.log("✅ Index settings applied successfully.");
  } catch (err: unknown) {
    console.warn("⚠️ Warning applying index settings:", err instanceof Error ? err.message : String(err));
  }

  // 5. Bulk Upload in chunks
  console.log(`📤 Pushing ${records.length} objects to index '${indexName}'...`);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    console.log(`   Uploading batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} items)...`);
    await client.saveObjects({
      indexName,
      objects: chunk,
    });
  }

  console.log("");
  console.log("=================================================");
  console.log(`🎉 SUCCESS! Backfilled ${records.length} items to Algolia index '${indexName}'.`);
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Fatal error during backfill:", err);
  process.exit(1);
});
