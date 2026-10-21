import { connection } from "next/server";
import {
  PrivyEarnConfigError,
  PrivyEarnRequestError,
  fetchPrivyEarnVaultDetailsBatch,
} from "@/lib/earn/privy-earn";
import {
  adminEarnJsonResponse,
  requireAdminEarnApi,
} from "@/lib/earn/require-admin-earn-api";
import { EARN_VAULT_IDS } from "@/lib/earn/vaults";

export async function GET(request: Request) {
  await connection();
  const gate = await requireAdminEarnApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const vaults = await fetchPrivyEarnVaultDetailsBatch(EARN_VAULT_IDS);
    return adminEarnJsonResponse({ vaults });
  } catch (error) {
    if (error instanceof PrivyEarnConfigError) {
      return adminEarnJsonResponse(
        { error: "privy_not_configured" },
        { status: 503 },
      );
    }
    if (error instanceof PrivyEarnRequestError) {
      return adminEarnJsonResponse(
        { error: error.code },
        { status: error.status },
      );
    }
    console.error("[admin-earn] vaults_fetch_failed", {
      code: "earn_vaults_fetch_failed",
    });
    return adminEarnJsonResponse(
      { error: "earn_vaults_unavailable" },
      { status: 502 },
    );
  }
}
