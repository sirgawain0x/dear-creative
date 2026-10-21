"use client";

import Link from "next/link";
import { useState } from "react";
import { createRadixLayerFocusHandlers } from "@/lib/utils/radixLayerFocus";
import { useReaderWalletAddress } from "@/lib/wallet/use-reader-wallet-address";
import { useAuthSession } from "@/components/providers/app-providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ReaderAccountMenuBody } from "./reader-account-menu-body";
import type { ReaderWalletPreviewData } from "./reader-wallet-panel";
import { ReaderAccountTrigger } from "./reader-account-trigger";

const dropdownFocusHandlers = createRadixLayerFocusHandlers(
  "[data-radix-menu-content]",
);

type ReaderAccountDropdownProps = {
  surface: "desktop" | "mobile";
  className?: string;
  /** Fixture/screenshot pages only — simulates a signed-in Privy session. */
  fixtureAuthenticated?: boolean;
  fixturePreviewData?: ReaderWalletPreviewData;
};

export function ReaderAccountDropdown({
  surface,
  className,
  fixtureAuthenticated = false,
  fixturePreviewData,
}: ReaderAccountDropdownProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const {
    authenticated,
    login,
    privyConfigured,
    privyTimedOut,
  } = useAuthSession();
  const sessionAuthenticated = fixtureAuthenticated || authenticated;
  const { address, loading } = useReaderWalletAddress(
    sessionAuthenticated && !fixturePreviewData,
  );
  const displayAddress = fixturePreviewData?.summary.address ?? address;

  const signedOutLinksToAdmin =
    !sessionAuthenticated && (!privyConfigured || privyTimedOut);

  const signInButtonClassName =
    "rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900";

  const testId =
    surface === "desktop"
      ? "reader-wallet-header-button"
      : "reader-wallet-header-button-mobile";

  if (signedOutLinksToAdmin) {
    return (
      <Link
        href="/admin"
        data-testid={testId}
        className={`inline-flex ${signInButtonClassName} ${className ?? ""}`}
      >
        Sign In
      </Link>
    );
  }

  if (!sessionAuthenticated) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={login}
        disabled={privyTimedOut}
        className={`inline-flex ${signInButtonClassName} ${className ?? ""}`}
      >
        Sign In
      </button>
    );
  }

  if (surface === "desktop") {
    return (
      <div className={className}>
        <DropdownMenu open={desktopOpen} onOpenChange={setDesktopOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              data-testid="reader-wallet-header-button"
              className="outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-full"
            >
              <ReaderAccountTrigger address={displayAddress} loading={loading} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            data-radix-menu-content
            data-testid="reader-account-dropdown"
            className="w-[min(calc(100vw-2rem),24rem)] max-h-[min(70vh,36rem)] overflow-y-auto p-3"
            onCloseAutoFocus={dropdownFocusHandlers.onCloseAutoFocus}
          >
            <ReaderAccountMenuBody
              previewData={fixturePreviewData}
              fixtureShowAdmin={fixtureAuthenticated}
              onNavigate={() => setDesktopOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className={className}>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            data-testid={testId}
            className="outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-full"
          >
            <ReaderAccountTrigger address={displayAddress} loading={loading} />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Wallet</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto pr-1">
            <ReaderAccountMenuBody
              previewData={fixturePreviewData}
              fixtureShowAdmin={fixtureAuthenticated}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
