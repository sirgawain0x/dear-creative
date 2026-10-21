"use client";

import {
  getEmbeddedConnectedWallet,
  useSign7702Authorization,
  useWallets,
} from "@privy-io/react-auth";
import { getAddress, type Address, type Hex } from "viem";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { signSwapPreparedCall } from "@/lib/wallet/wallet-swap-sign";

export function useAdminSwapSigner(adminWalletAddress: string): {
  signPreparedSwap: (prepared: Record<string, unknown>) => Promise<Hex>;
} | null {
  const { wallets } = useWallets();
  const { signAuthorization } = useSign7702Authorization();
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

  const signPreparedSwap = useCallback(
    async (prepared: Record<string, unknown>) => {
      if (!admin || !embedded) {
        throw new Error("Embedded admin wallet is not ready.");
      }
      if (embedded.address.toLowerCase() !== admin.toLowerCase()) {
        throw new Error("Connected wallet does not match admin wallet.");
      }
      const provider = await embedded.getEthereumProvider();
      const { signature } = await signSwapPreparedCall({
        provider,
        adminAddress: admin,
        prepared,
        signAuthorization: async ({ contractAddress, chainId }) => {
          const auth = await signAuthorization(
            { contractAddress, chainId },
            { address: admin as Address },
          );
          return auth as unknown as Hex;
        },
      });
      return signature;
    },
    [admin, embedded, signAuthorization],
  );

  if (!admin || !embedded) {
    return null;
  }

  return { signPreparedSwap };
}

export function AdminWalletSwapEmbeddedBridge({
  adminWalletAddress,
  children,
}: {
  adminWalletAddress: string;
  children: (signer: { signPreparedSwap: (prepared: Record<string, unknown>) => Promise<Hex> } | null) => ReactNode;
}) {
  const signer = useAdminSwapSigner(adminWalletAddress);
  return children(signer);
}
