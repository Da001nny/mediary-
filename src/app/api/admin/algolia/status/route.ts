import { NextResponse } from "next/server";
import { getAlgoliaServerConfig, getAlgoliaClientConfig } from "@/lib/algolia";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminUser } from "@/lib/auth/admin";

export async function GET() {
  const adminCheck = await verifyAdminUser();
  if (!adminCheck.isAdmin) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: adminCheck.error || "Admin access required",
      },
      { status: adminCheck.userId ? 403 : 401 }
    );
  }

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
