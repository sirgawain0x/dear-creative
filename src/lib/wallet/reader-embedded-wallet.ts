import type { User } from "@privy-io/server-auth";
import { getAddress, type Address } from "viem";
import { extractBearerToken } from "@/lib/privy/verify";
import { getPrivyServerClient } from "@/lib/privy/server-client";

export type ReaderEmbeddedWallet = {
  privyUserId: string;
  address: Address;
};

function isPrivyEmbeddedLinkedWallet(
  account: User["linkedAccounts"][number],
): account is User["linkedAccounts"][number] & {
  address: string;
  walletClientType: string;
} {
  return (
    account.type === "wallet" &&
    "address" in account &&
    typeof account.address === "string" &&
    account.address.startsWith("0x") &&
    "walletClientType" in account &&
    account.walletClientType === "privy"
  );
}

/** Privy user → checksummed embedded wallet address, or null when none exists. */
export function resolvePrivyEmbeddedWalletAddress(user: User): Address | null {
  const primary = user.wallet?.address;
  if (primary?.startsWith("0x")) {
    try {
      return getAddress(primary);
    } catch {
      // fall through to linked accounts
    }
  }

  for (const account of user.linkedAccounts) {
    if (!isPrivyEmbeddedLinkedWallet(account)) {
      continue;
    }
    try {
      return getAddress(account.address);
    } catch {
      // skip malformed row
    }
  }

  return null;
}

let readerEmbeddedWalletResolverOverride:
  | ((token: string) => Promise<ReaderEmbeddedWallet | null>)
  | null
  | undefined;

export function setReaderEmbeddedWalletResolverForTests(
  resolver: ((token: string) => Promise<ReaderEmbeddedWallet | null>) | null,
): void {
  readerEmbeddedWalletResolverOverride = resolver;
}

export function resetReaderEmbeddedWalletResolverForTests(): void {
  readerEmbeddedWalletResolverOverride = undefined;
}

/**
 * Bearer token → embedded wallet for that Privy user only (never accepts client address hints).
 */
export async function resolveReaderEmbeddedWalletFromAuthorization(
  authorizationHeader: string | null,
): Promise<ReaderEmbeddedWallet | null> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  if (readerEmbeddedWalletResolverOverride !== undefined) {
    if (readerEmbeddedWalletResolverOverride === null) {
      return null;
    }
    return readerEmbeddedWalletResolverOverride(token);
  }

  const client = getPrivyServerClient();
  if (!client) {
    return null;
  }

  try {
    const claims = await client.verifyAuthToken(token);
    if (!claims.userId) {
      return null;
    }
    const user = await client.getUserById(claims.userId);
    if (!user) {
      return null;
    }
    const address = resolvePrivyEmbeddedWalletAddress(user);
    if (!address) {
      return null;
    }
    return { privyUserId: claims.userId, address };
  } catch {
    return null;
  }
}
