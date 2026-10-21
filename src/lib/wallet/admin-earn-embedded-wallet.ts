import { getAddress, type Address } from "viem";

export type AdminEarnActionWallet = {
  walletId: string;
  walletAddress: Address;
};

export type EarnActionPrivyUser = {
  wallet?: { id?: string | null; address?: string } | null;
  linkedAccounts?: Array<{
    type: string;
    id?: string | null;
    address?: string;
    walletClientType?: string;
  }>;
};

type EmbeddedWalletLike = {
  address: string;
  walletClientType?: string;
  connectorType?: string;
  imported?: boolean;
};

function normalizeAddress(address: string): Address | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

function isPrivyEmbeddedConnectedWallet(
  wallet: EmbeddedWalletLike,
): boolean {
  return (
    wallet.walletClientType === "privy" &&
    wallet.connectorType === "embedded" &&
    wallet.imported !== true
  );
}

/** Privy embedded wallet from `useWallets()` suitable for browser-signed Earn actions. */
export function pickPrivyEmbeddedConnectedWallet(
  wallets: EmbeddedWalletLike[],
): EmbeddedWalletLike | null {
  return (
    wallets.find((wallet) => isPrivyEmbeddedConnectedWallet(wallet)) ?? null
  );
}

/**
 * Maps the connected embedded wallet to Privy wallet id + address for Earn actions.
 * Prefer `user.wallet` id when it matches the embedded address (CTO: no server admin wallet).
 */
export function resolveAdminEarnActionWallet(input: {
  user: EarnActionPrivyUser | null | undefined;
  wallets: EmbeddedWalletLike[];
}): AdminEarnActionWallet | null {
  const embedded = pickPrivyEmbeddedConnectedWallet(input.wallets);
  if (!embedded) {
    return null;
  }
  const walletAddress = normalizeAddress(embedded.address);
  if (!walletAddress) {
    return null;
  }

  const primaryId = input.user?.wallet?.id?.trim();
  const primaryAddress = input.user?.wallet?.address;
  if (
    primaryId &&
    primaryAddress &&
    normalizeAddress(primaryAddress)?.toLowerCase() ===
      walletAddress.toLowerCase()
  ) {
    return { walletId: primaryId, walletAddress };
  }

  for (const account of input.user?.linkedAccounts ?? []) {
    if (account.type !== "wallet") {
      continue;
    }
    const linked = account as {
      id?: string | null;
      address?: string;
      walletClientType?: string;
    };
    if (linked.walletClientType !== "privy" || !linked.id) {
      continue;
    }
    const linkedAddress = linked.address
      ? normalizeAddress(linked.address)
      : null;
    if (
      linkedAddress &&
      linkedAddress.toLowerCase() === walletAddress.toLowerCase()
    ) {
      return { walletId: linked.id, walletAddress };
    }
  }

  return null;
}
