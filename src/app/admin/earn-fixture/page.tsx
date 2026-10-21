import { notFound } from "next/navigation";
import type { AdminEarnPreviewData } from "@/components/admin/admin-earn-panel";
import { AdminEarnPanel } from "@/components/admin/admin-earn-panel";
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
      total_rewards_apr: 45,
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
    [EARN_VAULT_MORPHO_ID]: {
      configured: true,
      vaultId: EARN_VAULT_MORPHO_ID,
      position: {
        asset: { symbol: "usdc", decimals: 6 },
        total_deposited: "500000000",
        total_withdrawn: "0",
        assets_in_vault: "525000000",
      },
    },
  },
};

export default function AdminEarnFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Admin Earn preview (fixture)
        </p>
        <h1 className="text-2xl font-bold">Earn vaults</h1>
      </div>
      <AdminEarnPanel earnEnabled previewData={previewData} />
    </main>
  );
}
