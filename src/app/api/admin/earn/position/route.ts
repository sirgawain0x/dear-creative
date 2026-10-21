import { connection } from "next/server";
import { resolveAdminPrivyWalletId } from "@/lib/earn/admin-wallet-id";
import { getPrivyServerClient } from "@/lib/privy/server-client";
import {
  PrivyEarnConfigError,
  PrivyEarnRequestError,
  fetchPrivyEarnVaultPosition,
} from "@/lib/earn/privy-earn";
import {
  adminEarnJsonResponse,
  requireAdminEarnApi,
} from "@/lib/earn/require-admin-earn-api";
import { isKnownEarnVaultId } from "@/lib/earn/vaults";

export async function GET(request: Request) {
  await connection();
  const gate = await requireAdminEarnApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vault")?.trim() ?? "";
  if (!vaultId || !isKnownEarnVaultId(vaultId)) {
    return adminEarnJsonResponse(
      { error: "invalid_vault" },
      { status: 400 },
    );
  }

  const walletConfig = resolveAdminPrivyWalletId();
  if (!walletConfig.configured) {
    return adminEarnJsonResponse({
      configured: false,
      reason: walletConfig.reason,
      vaultId,
    });
  }

  try {
    const position = await fetchPrivyEarnVaultPosition(
      walletConfig.walletId,
      vaultId,
    );
    let walletAddress: string | null = null;
    const privyClient = getPrivyServerClient();
    if (privyClient) {
      try {
        const wallet = await privyClient.walletApi.getWallet({
          id: walletConfig.walletId,
        });
        walletAddress = wallet.address;
      } catch {
        walletAddress = null;
      }
    }
    return adminEarnJsonResponse({
      configured: true,
      vaultId,
      walletId: walletConfig.walletId,
      walletAddress,
      position,
    });
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
    console.error("[admin-earn] position_fetch_failed", {
      code: "earn_position_fetch_failed",
      vaultId,
    });
    return adminEarnJsonResponse(
      { error: "earn_position_unavailable" },
      { status: 502 },
    );
  }
}
