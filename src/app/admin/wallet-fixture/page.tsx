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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-0.5 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <span>Newsletter Administration</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Admin wallet (fixture)</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Mocked owner address for PR screenshots — same Receive QR as /admin when signed in.
        </p>
      </div>
      <WalletFixtureClient previewData={previewData} />
    </main>
  );
}
