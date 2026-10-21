import { notFound } from "next/navigation";
import { getAddress } from "viem";
import type { ReaderWalletPreviewData } from "@/components/wallet/reader-wallet-panel";
import { ReaderWalletPanel } from "@/components/wallet/reader-wallet-panel";
import { isReaderWalletFixturePageEnabled } from "@/lib/wallet/reader-wallet-fixture-page";

const previewData: ReaderWalletPreviewData = {
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
        id: "fixture-out-usdc",
        direction: "out",
        asset: "USDC",
        value: "25.00",
        hash: "0x3333333333333333333333333333333333333333333333333333333333333333",
        timestamp: "2026-01-14T08:30:00Z",
      },
    ],
  },
};

export default function ReaderWalletFixturePage() {
  if (!isReaderWalletFixturePageEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Reader wallet (fixture)</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Mocked embedded wallet for PR screenshots — same Receive QR as the header sheet.
        </p>
      </div>
      <ReaderWalletPanel previewData={previewData} />
    </main>
  );
}
