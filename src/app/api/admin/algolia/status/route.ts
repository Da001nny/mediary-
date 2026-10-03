import { NextResponse } from "next/server";
import { getAlgoliaServerConfig, getAlgoliaClientConfig } from "@/lib/algolia";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const clientConfig = getAlgoliaClientConfig();
  const serverConfig = getAlgoliaServerConfig();

  let mediaCount = 0;
  try {
    const adminClient = createAdminClient();
    if (adminClient) {
      const { count } = await adminClient
        .from("media")
        .select("*", { count: "exact", head: true });
      mediaCount = count || 0;
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    appIdConfigured: Boolean(clientConfig.appId),
    searchKeyConfigured: Boolean(clientConfig.searchApiKey),
    adminKeyConfigured: Boolean(serverConfig.adminApiKey),
    indexName: clientConfig.indexName,
    mediaRecordsInDatabase: mediaCount,
    readyForSearch: clientConfig.isConfigured,
    readyForBackfill: serverConfig.isAdminConfigured,
  });
}
