"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
import { ReaderWalletCheckoutSheet } from "./reader-wallet-onramp";
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
  fixtureShowAdmin?: boolean;
};

export function ReaderAccountDropdown({
  surface,
  className,
  fixtureAuthenticated = false,
  fixturePreviewData,
  fixtureShowAdmin = false,
}: ReaderAccountDropdownProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const handingOffFocus = useRef(false);
  const accountTrigger = useRef<HTMLButtonElement>(null);
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

  function openCheckout() {
    handingOffFocus.current = true;
    setAccountOpen(false);
    setCheckoutOpen(true);
  }

  const checkout = (
    <ReaderWalletCheckoutSheet
      open={checkoutOpen}
      onOpenChange={setCheckoutOpen}
      restoreFocus={() => {
        handingOffFocus.current = false;
        accountTrigger.current?.focus();
      }}
    />
  );

  if (surface === "desktop") {
    return (
      <div className={className}>
        <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              ref={accountTrigger}
              aria-label="Open account menu"
              data-testid="reader-wallet-header-button"
              className="outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-full"
            >
              <ReaderAccountTrigger
                address={displayAddress}
                loading={loading}
                showAddress
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            data-radix-menu-content
            data-testid="reader-account-dropdown"
            className="flex w-[min(calc(100vw-2rem),24rem)] max-h-[min(70vh,36rem)] flex-col overflow-hidden p-0"
            onCloseAutoFocus={(event) => {
              if (handingOffFocus.current) event.preventDefault();
              else dropdownFocusHandlers.onCloseAutoFocus(event);
            }}
          >
            <ReaderAccountMenuBody
              previewData={fixturePreviewData}
              fixtureShowAdmin={fixtureShowAdmin}
              onNavigate={() => setAccountOpen(false)}
              onOpenCheckout={openCheckout}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {checkout}
      </div>
    );
  }

  return (
    <div className={className}>
      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            ref={accountTrigger}
            aria-label="Open account menu"
            data-testid={testId}
            className="outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-full"
          >
            <ReaderAccountTrigger
              address={displayAddress}
              loading={loading}
              showAddress={false}
            />
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!handingOffFocus.current) accountTrigger.current?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>Wallet</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto pr-1">
            <ReaderAccountMenuBody
              previewData={fixturePreviewData}
              fixtureShowAdmin={fixtureShowAdmin}
              onNavigate={() => setAccountOpen(false)}
              onOpenCheckout={openCheckout}
            />
          </div>
        </SheetContent>
      </Sheet>
      {checkout}
    </div>
  );
}
