"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { privyAuthorizationHeaders } from "@/lib/privy/privy-authorization-headers";
import { useAuthSession } from "@/components/providers/app-providers";
import {
  ReaderWalletPanel,
  type ReaderWalletPreviewData,
} from "./reader-wallet-panel";

type ReaderAccountMenuBodyProps = {
  onSignOut?: () => void;
  onNavigate?: () => void;
  previewData?: ReaderWalletPreviewData;
  /** Fixture only — skip live admin fetch and show Admin Console link. */
  fixtureShowAdmin?: boolean;
};

export function ReaderAccountMenuBody({
  onSignOut,
  onNavigate,
  previewData,
  fixtureShowAdmin = false,
}: ReaderAccountMenuBodyProps) {
  const { authenticated, signOut, getAccessToken, privyConfigured } = useAuthSession();
  const [isAdminLive, setIsAdminLive] = useState(false);
  const [walletAddressLive, setWalletAddressLive] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy address");

  const isAdmin = fixtureShowAdmin || isAdminLive;
  const walletAddress = previewData?.summary.address ?? walletAddressLive;

  useEffect(() => {
    if (previewData || fixtureShowAdmin || !authenticated) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const headers = await privyAuthorizationHeaders({
          privyConfigured,
          authenticated,
          getAccessToken,
        });
        if (!headers || cancelled) {
          return;
        }
        const [adminRes, walletRes] = await Promise.all([
          fetch("/api/admin/me", { headers }),
          fetch("/api/wallet/me", { headers }),
        ]);
        if (!cancelled && adminRes.ok) {
          const adminBody = (await adminRes.json()) as { isAdmin?: boolean };
          setIsAdminLive(Boolean(adminBody.isAdmin));
        }
        if (!cancelled && walletRes.ok) {
          const walletBody = (await walletRes.json()) as {
            configured?: boolean;
            address?: string;
          };
          setWalletAddressLive(
            walletBody.configured && walletBody.address ? walletBody.address : null,
          );
        }
      } catch {
        if (!cancelled) {
          setIsAdminLive(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, fixtureShowAdmin, getAccessToken, previewData, privyConfigured]);

  const handleCopyAddress = useCallback(async () => {
    if (!walletAddress) {
      return;
    }
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopyLabel("Copied!");
      window.setTimeout(() => setCopyLabel("Copy address"), 2000);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy address"), 2000);
    }
    onNavigate?.();
  }, [onNavigate, walletAddress]);

  const handleSignOut = () => {
    onNavigate?.();
    onSignOut?.();
    void signOut();
  };

  return (
    <div className="flex flex-col gap-4" data-testid="reader-account-menu-body">
      <ReaderWalletPanel previewData={previewData} />
      <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          data-testid="reader-account-copy-address"
          disabled={!walletAddress}
          onClick={() => void handleCopyAddress()}
          className="rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {copyLabel}
        </button>
        {isAdmin ? (
          <Link
            href="/admin"
            data-testid="reader-account-admin-console"
            onClick={() => onNavigate?.()}
            className="rounded-lg px-2 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Admin Console
          </Link>
        ) : null}
        <button
          type="button"
          data-testid="reader-account-sign-out"
          onClick={handleSignOut}
          className="rounded-lg px-2 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
