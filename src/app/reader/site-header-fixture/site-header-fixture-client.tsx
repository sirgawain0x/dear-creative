"use client";

import { SiteHeader } from "@/components/site-header";
import type { ReaderWalletPreviewData } from "@/components/wallet/reader-wallet-panel";

const FIXTURE_PREVIEW: ReaderWalletPreviewData = {
  summary: {
    configured: true,
    address: "0x1234567890abcdef1234567890abcdef12345678",
    network: "base",
    chainId: 8453,
    balances: {
      eth: { formatted: "0.01" },
      usdc: { formatted: "12.34" },
    },
  },
  history: { configured: true, transfers: [] },
};

type SiteHeaderFixtureClientProps = {
  showAdmin?: boolean;
};

export function SiteHeaderFixtureClient({ showAdmin = false }: SiteHeaderFixtureClientProps) {
  return (
    <div data-testid="site-header-fixture" className="min-h-[120vh] bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader
        readerWalletEnabled
        fixtureAuthenticated
        fixturePreviewData={FIXTURE_PREVIEW}
        fixtureShowAdmin={showAdmin}
      />
      <p className="p-6 text-sm text-zinc-600 dark:text-zinc-400">
        Real site header fixture for PR screenshots (signed-in reader wallet).
      </p>
    </div>
  );
}
