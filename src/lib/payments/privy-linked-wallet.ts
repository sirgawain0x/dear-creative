import type { User } from "@privy-io/server-auth";
import { getAddress } from "viem";
import { getPrivyServerClient } from "@/lib/privy/server-client";
import { extractBearerToken } from "@/lib/privy/verify";

export type PaymentsLinkedWallet = {
  privyUserId: string;
  signerAddress: `0x${string}`;
};

function isWalletLinkedAccount(
  account: User["linkedAccounts"][number],
): account is User["linkedAccounts"][number] & { address: string } {
  return (
    account.type === "wallet" &&
    "address" in account &&
    typeof account.address === "string" &&
    account.address.startsWith("0x")
  );
}

/** All linked wallet accounts on the Privy user, checksummed (invalid entries skipped). */
export function listChecksumLinkedWalletAddresses(user: User): string[] {
  const linkedWallets = user.linkedAccounts.filter(isWalletLinkedAccount);
  const out: string[] = [];
  for (const wallet of linkedWallets) {
    try {
      out.push(getAddress(wallet.address));
    } catch {
      // skip malformed linked wallet rows
    }
  }
  return out;
}

function pickLinkedWalletAddress(
  user: User,
  activeWalletHint?: string,
): `0x${string}` | null {
  const linkedWallets = user.linkedAccounts.filter(isWalletLinkedAccount);
  if (linkedWallets.length === 0) {
    return null;
  }

  const hint = activeWalletHint?.trim().toLowerCase();
  if (hint) {
    const match = linkedWallets.find(
      (w) => w.address.toLowerCase() === hint,
    );
    if (!match) {
      return null;
    }
    return match.address.toLowerCase() as `0x${string}`;
  }

  const embedded = user.wallet?.address;
  if (embedded?.startsWith("0x")) {
    const lower = embedded.toLowerCase();
    const embeddedLinked = linkedWallets.find(
      (w) => w.address.toLowerCase() === lower,
    );
    if (embeddedLinked) {
      return lower as `0x${string}`;
    }
  }

  return linkedWallets[0]!.address.toLowerCase() as `0x${string}`;
}

let linkedWalletResolverOverride:
  | ((
      token: string,
      activeWalletHint?: string,
    ) => Promise<PaymentsLinkedWallet | null>)
  | null
  | undefined;

export function setPaymentsLinkedWalletResolverForTests(
  resolver:
    | ((
        token: string,
        activeWalletHint?: string,
      ) => Promise<PaymentsLinkedWallet | null>)
    | null,
): void {
  linkedWalletResolverOverride = resolver;
}

export function resetPaymentsLinkedWalletResolverForTests(): void {
  linkedWalletResolverOverride = undefined;
}

let linkedChecksumAddressesResolverOverride:
  | ((token: string) => Promise<string[] | null>)
  | null
  | undefined;

export function setPrivyLinkedChecksumAddressesResolverForTests(
  resolver: ((token: string) => Promise<string[] | null>) | null,
): void {
  linkedChecksumAddressesResolverOverride = resolver;
}

export function resetPrivyLinkedChecksumAddressesResolverForTests(): void {
  linkedChecksumAddressesResolverOverride = undefined;
}

/**
 * Privy bearer token → all linked wallet addresses (checksummed).
 * Returns null when there is no token or Privy user; [] when the user has no linked wallets.
 */
export async function resolvePrivyLinkedChecksumWalletAddresses(
  authorizationHeader: string | null,
): Promise<string[] | null> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  if (linkedChecksumAddressesResolverOverride !== undefined) {
    if (linkedChecksumAddressesResolverOverride === null) {
      return null;
    }
    return linkedChecksumAddressesResolverOverride(token);
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
    return listChecksumLinkedWalletAddresses(user);
  } catch {
    return null;
  }
}

/**
 * Privy access token + linked wallet (active/embedded, else first).
 * Used only when payments are enabled; does not alter core Privy verify helpers.
 */
export async function resolvePaymentsLinkedWallet(
  authorizationHeader: string | null,
  activeWalletHint?: string,
): Promise<PaymentsLinkedWallet | null> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  if (linkedWalletResolverOverride !== undefined) {
    if (linkedWalletResolverOverride === null) {
      return null;
    }
    return linkedWalletResolverOverride(token, activeWalletHint);
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
    const signerAddress = pickLinkedWalletAddress(user, activeWalletHint);
    if (!signerAddress) {
      return null;
    }
    return { privyUserId: claims.userId, signerAddress };
  } catch {
    return null;
  }
}
