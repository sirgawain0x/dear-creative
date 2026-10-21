"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import type { ReactNode } from "react";
import type { SmartWalletSendClient } from "@/lib/wallet/wallet-send-smart-wallet";

export function useAdminSmartWalletSendClient(): SmartWalletSendClient | null {
  const { client } = useSmartWallets();
  if (!client) {
    return null;
  }
  return {
    sendTransaction: (input) =>
      client.sendTransaction({
        calls: input.calls,
      }),
  };
}

export function AdminWalletSendSmartWalletBridge({
  children,
}: {
  children: (client: SmartWalletSendClient | null) => ReactNode;
}) {
  const client = useAdminSmartWalletSendClient();
  return <>{children(client)}</>;
}
