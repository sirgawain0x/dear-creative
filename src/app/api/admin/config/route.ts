import { connection, NextResponse } from "next/server";
import { getAdamApiToken } from "@/lib/adam/require-auth";
import { getPrivyAppId } from "@/lib/privy/config";
import { isEarnEnabled } from "@/lib/earn/feature-flag";
import { isWalletEnabled } from "@/lib/wallet/feature-flag";
import { isWalletSendEnabled } from "@/lib/wallet/send-feature-flag";
import { isWalletSwapEnabled } from "@/lib/wallet/swap-feature-flag";

const ADMIN_CONFIG_CACHE_CONTROL = "private, no-store";

export function adminConfigResponse(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", ADMIN_CONFIG_CACHE_CONTROL);
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function GET() {
  await connection();
  try {
    const privyAppId = getPrivyAppId() ?? null;
    return adminConfigResponse({
      privyAppId,
      privyConfigured: Boolean(privyAppId),
      adamTokenConfigured: Boolean(getAdamApiToken()),
      walletEnabled: isWalletEnabled(),
      walletSendEnabled: isWalletSendEnabled(),
      walletSwapEnabled: isWalletSwapEnabled(),
      earnEnabled: isEarnEnabled(),
    });
  } catch {
    return adminConfigResponse(
      { error: "admin_config_unavailable" },
      { status: 500 },
    );
  }
}
