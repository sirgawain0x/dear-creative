"use client";

import { useMemo } from "react";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import { createAdminWalletSwapPort } from "@/lib/wallet/admin-wallet-swap-port";
import { WalletSwapForm } from "@/components/wallet/wallet-swap-form";
import type { WalletSwapQuoteSummary } from "@/components/wallet/wallet-swap-types";
import type { Hex } from "viem";

export type AdminWalletSwapFormProps = {
  walletAddress: string;
  isAdmin: boolean;
  walletSwapEnabled: boolean;
  getAccessToken: () => Promise<string | null>;
  privyConfigured: boolean;
  authenticated: boolean;
  signPreparedSwap?: (prepared: Record<string, unknown>) => Promise<Hex>;
  previewMode?: boolean;
  fixtureInitialStep?: "form" | "confirm" | "pending" | "success";
  fixtureQuote?: WalletSwapQuoteSummary;
};

const DEFAULT_FIXTURE_QUOTE: WalletSwapQuoteSummary = {
  from: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
  direction: "USDC_TO_ETH",
  amount: "25",
  slippageBps: 50,
  chainId: 8453,
  needsWalletUpgrade: true,
  quote: {
    expiry: new Date(Date.now() + 120_000).toISOString(),
    minimumToAmount: "0x38d7ea4c68000",
    fromAmount: "0x5f5e100",
  },
  prepared: { type: "user-operation-v070" },
};

export function AdminWalletSwapForm({
  walletAddress,
  isAdmin,
  walletSwapEnabled,
  getAccessToken,
  privyConfigured,
  authenticated,
  signPreparedSwap,
  previewMode = false,
  fixtureInitialStep,
  fixtureQuote,
}: AdminWalletSwapFormProps) {
  const swapPort = useMemo(
    () =>
      createAdminWalletSwapPort({
        previewMode,
        getRequestHeaders: async () =>
          adminPrivyAuthorizationHeaders({
            privyConfigured,
            authenticated,
            getAccessToken,
          }),
      }),
    [authenticated, getAccessToken, previewMode, privyConfigured],
  );

  return (
    <WalletSwapForm
      enabled={isAdmin && walletSwapEnabled}
      adminAddress={walletAddress}
      swapPort={swapPort}
      signPreparedSwap={signPreparedSwap}
      fixtureInitialStep={fixtureInitialStep}
      fixtureQuote={fixtureQuote ?? (previewMode ? DEFAULT_FIXTURE_QUOTE : undefined)}
    />
  );
}
