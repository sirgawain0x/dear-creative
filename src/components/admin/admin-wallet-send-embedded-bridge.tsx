"use client";

import { getEmbeddedConnectedWallet, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { getAddress, type Address } from "viem";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import {
  createDefaultEmbeddedSendExecutor,
  type EmbeddedWalletSendExecutor,
} from "@/lib/wallet/admin-wallet-send-port";
import {
  assertEmbeddedSignerIsAdmin,
  BASE_CHAIN_ID,
  ensureBaseChain,
} from "@/lib/wallet/wallet-send-embedded";

export function useAdminEmbeddedWalletSend(
  adminWalletAddress: string,
): EmbeddedWalletSendExecutor | null {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const admin = useMemo(() => {
    try {
      return getAddress(adminWalletAddress);
    } catch {
      return null;
    }
  }, [adminWalletAddress]);

  const embedded = useMemo(() => {
    if (!admin) {
      return null;
    }
    return getEmbeddedConnectedWallet(wallets);
  }, [admin, wallets]);

  const getProvider = useCallback(async () => {
    if (!embedded) {
      return null;
    }
    return embedded.getEthereumProvider();
  }, [embedded]);

  return useMemo(() => {
    if (!admin || !embedded) {
      return null;
    }
    if (embedded.address.toLowerCase() !== admin.toLowerCase()) {
      return null;
    }
    return createDefaultEmbeddedSendExecutor(getProvider, async (tx, opts) => {
      const provider = await getProvider();
      if (!provider) {
        throw new Error("Embedded wallet is not ready.");
      }
      await ensureBaseChain(provider);
      await assertEmbeddedSignerIsAdmin(provider, admin);
      if (tx.chainId !== BASE_CHAIN_ID) {
        throw new Error("Transaction must target Base (chain 8453).");
      }
      return sendTransaction(
        {
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId: tx.chainId,
        },
        {
          ...(opts?.sponsor ? { sponsor: true } : {}),
          address: admin as Address,
        },
      );
    });
  }, [admin, embedded, getProvider, sendTransaction]);
}

export function AdminWalletSendEmbeddedBridge({
  adminWalletAddress,
  children,
}: {
  adminWalletAddress: string;
  children: (embeddedSend: EmbeddedWalletSendExecutor | null) => ReactNode;
}) {
  const embeddedSend = useAdminEmbeddedWalletSend(adminWalletAddress);
  return children(embeddedSend);
}
