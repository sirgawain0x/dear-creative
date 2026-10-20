import { notFound } from "next/navigation";
import type { AdminWalletPreviewData } from "@/components/admin/admin-wallet-panel";
import { WalletFixtureClient } from "./wallet-fixture-client";
import { getAddress } from "viem";
import { isWalletReadFixtureEnabled } from "@/lib/wallet/asset-transfers";

const previewData: AdminWalletPreviewData = {
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
    transfers: [
      {
        id: "fixture-in-usdc",
        direction: "in",
        asset: "USDC",
        value: "100.00",
        hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        timestamp: "2026-01-15T12:00:00Z",
      },
      {
        id: "fixture-out-eth",
        direction: "out",
        asset: "ETH",
        value: "0.01",
        hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        timestamp: "2026-01-14T08:30:00Z",
      },
    ],
    pagination: { incomingPageKey: null, outgoingPageKey: null },
  },
};

export default function AdminWalletFixturePage() {
  if (!isWalletReadFixtureEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[390px] px-4 py-8">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Admin wallet preview (fixture)
        </p>
        <h1 className="text-xl font-bold">Funds</h1>
      </div>
      <WalletFixtureClient previewData={previewData} />
    </main>
  );
}
