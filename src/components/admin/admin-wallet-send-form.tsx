"use client";

import { useMemo } from "react";
import { adminPrivyAuthorizationHeaders } from "@/lib/admin/admin-api-auth";
import { createAdminWalletSendPort } from "@/lib/wallet/admin-wallet-send-port";
import type { EmbeddedWalletSendExecutor } from "@/lib/wallet/admin-wallet-send-port";
import { WalletSendForm } from "@/components/wallet/wallet-send-form";
import type { WalletSendBalances } from "@/components/wallet/wallet-send-types";

export type AdminWalletSendFormProps = {
  walletAddress: string;
  balances?: WalletSendBalances;
  chainId?: number;
  network?: string;
  isAdmin: boolean;
  walletSendEnabled: boolean;
  getAccessToken: () => Promise<string | null>;
  privyConfigured: boolean;
  authenticated: boolean;
  embeddedSend?: EmbeddedWalletSendExecutor | null;
  previewMode?: boolean;
  fixtureInitialStep?: "form" | "confirm";
};

export function AdminWalletSendForm({
  walletAddress,
  balances,
  chainId = 8453,
  network = "base",
  isAdmin,
  walletSendEnabled,
  getAccessToken,
  privyConfigured,
  authenticated,
  embeddedSend,
  previewMode = false,
  fixtureInitialStep,
}: AdminWalletSendFormProps) {
  const sendPort = useMemo(
    () =>
      createAdminWalletSendPort({
        previewMode,
        embeddedSend,
        getRequestHeaders: async () => {
          const headers = await adminPrivyAuthorizationHeaders({
            privyConfigured,
            authenticated,
            getAccessToken,
          });
          return headers;
        },
      }),
    [
      authenticated,
      embeddedSend,
      getAccessToken,
      previewMode,
      privyConfigured,
    ],
  );

  return (
    <WalletSendForm
      enabled={isAdmin && walletSendEnabled}
      wallet={{
        address: walletAddress,
        chain: { network, chainId },
        balances,
      }}
      sendPort={sendPort}
      fixtureInitialStep={fixtureInitialStep}
    />
  );
}
