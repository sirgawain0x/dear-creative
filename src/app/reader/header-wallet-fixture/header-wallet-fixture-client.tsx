"use client";

import { useState } from "react";
import { ReaderWalletSheet } from "@/components/wallet/reader-wallet-sheet";

/**
 * Minimal repro: ReaderWalletSheet rendered inside a sticky header with backdrop-blur
 * (same stacking/containing-block context as SiteHeader).
 */
export function HeaderWalletFixtureClient() {
  const [walletOpen, setWalletOpen] = useState(false);

  return (
    <div data-testid="header-wallet-fixture" className="min-h-[120vh]">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-sm font-semibold">Fixture header (backdrop-blur)</span>
          <button
            type="button"
            data-testid="reader-wallet-header-button-mobile"
            onClick={() => setWalletOpen(true)}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold"
          >
            Wallet
          </button>
        </div>
        <ReaderWalletSheet open={walletOpen} onOpenChange={setWalletOpen} />
      </header>
      <p className="p-6 text-sm text-zinc-600">
        Tap Wallet to open the reader sheet. Before the portal fix, the overlay is
        clipped to this header strip on mobile browsers.
      </p>
    </div>
  );
}
