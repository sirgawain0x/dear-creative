"use client";

import { AdminEarnPanel } from "@/components/admin/admin-earn-panel";
import type { AdminEarnPreviewData } from "@/components/admin/admin-earn-panel";
import { AdminWalletPanel } from "@/components/admin/admin-wallet-panel";
import type { AdminWalletPreviewData } from "@/components/admin/admin-wallet-panel";
import {
  EARN_VAULT_AAVE_ID,
  EARN_VAULT_MORPHO_ID,
} from "@/lib/earn/vaults";
import { getAddress } from "viem";

const walletPreview: AdminWalletPreviewData = {
  summary: {
    configured: true,
    address: getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6"),
    network: "base",
    chainId: 8453,
    balances: {
      eth: { formatted: "0.042" },
      usdc: { formatted: "1250.50" },
    },
  },
  history: {
    configured: true,
    transfers: [],
    pagination: { incomingPageKey: null, outgoingPageKey: null },
  },
};

const earnPreview: AdminEarnPreviewData = {
  vaults: [
    {
      id: EARN_VAULT_AAVE_ID,
      name: "Aave USDC (Base)",
      provider: "aave",
      vault_address: "0x1234567890123456789012345678901234567890",
      asset: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "usdc",
        decimals: 6,
      },
      caip2: "eip155:8453",
      user_apy: 420,
      app_apy: 80,
      tvl_usd: 12_345_678,
      available_liquidity_usd: 9_876_543,
      admin_wallet_id: "fixture-admin-wallet",
      admin_wallet_address: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    },
  ],
  positions: {
    [EARN_VAULT_AAVE_ID]: {
      configured: true,
      vaultId: EARN_VAULT_AAVE_ID,
      position: {
        asset: { symbol: "usdc", decimals: 6 },
        total_deposited: "1000000000",
        total_withdrawn: "0",
        assets_in_vault: "1000000000",
      },
    },
    [EARN_VAULT_MORPHO_ID]: {
      configured: false,
      reason: "unset",
      vaultId: EARN_VAULT_MORPHO_ID,
    },
  },
};

/** Mirrors /admin console panel stack for layout screenshots. */
export function PanelsLayoutFixtureClient() {
  return (
    <div className="flex w-full flex-col gap-6" data-testid="admin-console-panels-stack">
      <AdminWalletPanel
        walletEnabled
        previewData={walletPreview}
        previewSendEnabled
      />
      <AdminEarnPanel earnEnabled previewData={earnPreview} />
    </div>
  );
}
