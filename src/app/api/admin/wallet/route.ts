import { NextResponse } from "next/server";
import { resolveAdminWalletConfig } from "@/lib/wallet/admin-wallet-address";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import {
  isWalletReadFixtureEnabled,
  walletReadFixtureResponse,
} from "@/lib/wallet/asset-transfers";
import { requireAdminWalletApi } from "@/lib/wallet/require-admin-wallet-api";

export async function GET(request: Request) {
  const gate = await requireAdminWalletApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return NextResponse.json({
      configured: false,
      reason: config.reason,
      network: "base",
      chainId: 8453,
    });
  }

  if (isWalletReadFixtureEnabled()) {
    const fixture = walletReadFixtureResponse();
    return NextResponse.json({
      configured: true,
      address: config.address,
      network: "base",
      chainId: 8453,
      balances: {
        eth: { raw: "42000000000000000", formatted: fixture.balances.eth },
        usdc: { raw: "1250500000", formatted: fixture.balances.usdc },
      },
      fixture: true,
    });
  }

  const balances = await fetchWalletBalances(config.address);
  return NextResponse.json({
    configured: true,
    address: config.address,
    network: "base",
    chainId: 8453,
    balances,
  });
}
