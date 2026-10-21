"use client";

import { ReaderAccountDropdown } from "@/components/wallet/reader-account-dropdown";
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

/** Minimal sticky header repro for account dropdown screenshots. */
export function AccountDropdownFixtureClient() {
  const dropdownProps = {
    fixtureAuthenticated: true as const,
    fixturePreviewData: FIXTURE_PREVIEW,
  };

  return (
    <div data-testid="account-dropdown-fixture" className="min-h-[120vh]">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3.5">
          <span className="text-sm font-semibold">Account dropdown fixture</span>
          <div className="hidden items-center gap-2 lg:flex">
            <ReaderAccountDropdown surface="desktop" {...dropdownProps} />
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <ReaderAccountDropdown surface="mobile" {...dropdownProps} />
          </div>
        </div>
      </header>
      <p className="p-6 text-sm text-zinc-600">
        Tap the identicon address control — menu content is portaled outside this blurred
        header.
      </p>
    </div>
  );
}
