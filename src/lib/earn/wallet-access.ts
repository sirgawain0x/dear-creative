import { getAddress, isAddress } from "viem";
import { getPrivyAdminUserIds } from "@/lib/privy/config";
import { getPrivyServerClient } from "@/lib/privy/server-client";
import type { User } from "@privy-io/server-auth";

export type EarnWalletAccessInput = {
  userId: string;
  walletId: string;
  walletAddress: string;
};

function normalizeUserId(userId: string): string {
  return userId.startsWith("did:privy:") ? userId : `did:privy:${userId}`;
}

function userLinkedWalletIds(user: User): Set<string> {
  const ids = new Set<string>();
  for (const account of user.linkedAccounts) {
    if (account.type !== "wallet") {
      continue;
    }
    const walletAccount = account as { id?: string | null; address?: string };
    if (walletAccount.id) {
      ids.add(walletAccount.id);
    }
  }
  if (user.wallet?.id) {
    ids.add(user.wallet.id);
  }
  return ids;
}

export async function assertEarnWalletAccess(
  input: EarnWalletAccessInput,
): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!isAddress(input.walletAddress)) {
    return { ok: false, code: "invalid_wallet_address" };
  }
  let expectedAddress: string;
  try {
    expectedAddress = getAddress(input.walletAddress);
  } catch {
    return { ok: false, code: "invalid_wallet_address" };
  }

  const client = getPrivyServerClient();
  if (!client) {
    return { ok: false, code: "privy_not_configured" };
  }

  let walletRecord;
  try {
    walletRecord = await client.walletApi.getWallet({ id: input.walletId });
  } catch {
    return { ok: false, code: "wallet_not_found" };
  }

  if (getAddress(walletRecord.address) !== expectedAddress) {
    return { ok: false, code: "wallet_address_mismatch" };
  }

  const adminIds = getPrivyAdminUserIds();
  const normalized = normalizeUserId(input.userId);
  if (adminIds.has(input.userId) || adminIds.has(normalized)) {
    return { ok: true };
  }

  let user: User;
  try {
    user = await client.getUser(normalized);
  } catch {
    return { ok: false, code: "user_not_found" };
  }

  const linkedIds = userLinkedWalletIds(user);
  if (!linkedIds.has(input.walletId)) {
    return { ok: false, code: "wallet_not_owned" };
  }

  return { ok: true };
}
