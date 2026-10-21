import { notFound } from "next/navigation";
import { AdminEarnPanel } from "@/components/admin/admin-earn-panel";
import type { AdminEarnPreviewData } from "@/components/admin/admin-earn-panel";
import type { EarnActionsPreviewState } from "@/components/earn/earn-actions-flow";
import {
  EARN_VAULT_AAVE_ID,
  EARN_VAULT_MORPHO_ID,
} from "@/lib/earn/vaults";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";

const previewData: AdminEarnPreviewData = {
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
      tvl_usd: 250_000,
      available_liquidity_usd: 180_000,
      admin_wallet_id: "fixture-admin-wallet",
      admin_wallet_address: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    },
    {
      id: EARN_VAULT_MORPHO_ID,
      name: "Gauntlet USDC Prime",
      provider: "morpho",
      vault_address: "0x04422053aDDbc9bB2759b248B574e3FCA76Bc145",
      asset: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "usdc",
        decimals: 6,
      },
      caip2: "eip155:8453",
      user_apy: 510,
      app_apy: 100,
      tvl_usd: 1_200_000,
      available_liquidity_usd: 640_000,
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
        total_withdrawn: "200000000",
        assets_in_vault: "850000000",
      },
    },
  },
};

function previewForState(
  state: string | undefined,
): EarnActionsPreviewState | undefined {
  switch (state) {
    case "confirm":
      return {
        phase: "confirm",
        direction: "deposit",
        amountDisplay: "125.50",
        vault: {
          id: EARN_VAULT_AAVE_ID,
          name: "Aave USDC (Base)",
          provider: "aave",
        },
      };
    case "pending":
      return {
        phase: "pending",
        actionId: "earn-action-fixture-pending",
        direction: "deposit",
      };
    case "success":
      return {
        phase: "success",
        actionId: "earn-action-fixture-success",
        direction: "withdraw",
      };
    default:
      return undefined;
  }
}

export default async function AdminEarnActionsFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }
  const params = await searchParams;
  const previewState = previewForState(params.state);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <AdminEarnPanel
        earnEnabled
        earnActionsEnabled
        earnActionsPreview={previewState}
        earnActionsWalletPreview={{
          walletId: "fixture-admin-wallet",
          walletAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
        }}
        previewData={previewData}
      />
    </main>
  );
}
