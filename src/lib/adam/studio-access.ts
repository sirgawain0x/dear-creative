import { getAddress, isAddress, type Address } from "viem";

/**
 * Access policy for Adam Studio.
 *
 * Adam Studio is the owner's private editorial tool. A viewer gets in when:
 *   1. their Privy user id is on `PRIVY_ADMIN_USER_IDS` (break-glass owner), or
 *   2. one of their linked wallets is on the Studio allowlist, or
 *   3. (when membership access is switched on) one of their linked wallets holds
 *      a valid Creative Creator Pass (Unlock membership NFT on Base), or
 *   4. they present the Studio Key (ADAM_API_TOKEN).
 *
 * Opening the studio to every pass holder is a product decision, not a code
 * default: `ADAM_STUDIO_MEMBERSHIP_ACCESS` stays `off` until per-member accounts
 * (own newsletter, own posts) are scoped. See docs/adam-studio-access.md.
 */

/** Unlock lock chain — Base mainnet only for now. */
export const CREATOR_PASS_CHAIN_ID = 8453;
export const CREATOR_PASS_CHAIN_NAME = "Base";

/** Unlock "Creative Creator" lock (symbol CRTVM) — $10 USDC / 30 days. */
export const CREATOR_PASS_LOCK_ADDRESS =
  "0xf7c4cd399395d80f9d61fde833849106775269c6" as Address;
export const CREATOR_PASS_NAME = "Creative Creator Pass";
export const CREATOR_PASS_SYMBOL = "CRTVM";
export const CREATOR_PASS_PRICE_USDC = 10;
export const CREATOR_PASS_PERIOD_DAYS = 30;

/** JSON-RPC timeout for a single membership read (ms). */
export const CREATOR_PASS_RPC_TIMEOUT_MS = 6_000;
/** How long a positive membership read is trusted (ms). */
export const CREATOR_PASS_CACHE_TTL_MS = 60_000;
/** How long a negative read is trusted before re-checking (ms). */
export const CREATOR_PASS_NEGATIVE_CACHE_TTL_MS = 20_000;

/** HttpOnly cookie that carries a verified Studio Key (see /api/adam/studio-key). */
export const ADAM_STUDIO_KEY_COOKIE = "dear_creative_studio_key";

/**
 * Owner wallets that always keep access to the internal studio.
 * G2's Privy embedded wallet (holds the Creative Creator Pass).
 * Merged with ADAM_STUDIO_ALLOWED_WALLETS, de-duplicated.
 */
export const OWNER_STUDIO_WALLETS: readonly string[] = [
  "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
];

/** Checksummed address, or null when the input is not a wallet address. */
export function normalizeWalletAddress(
  raw: string | null | undefined,
): Address | null {
  const trimmed = raw?.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  return getAddress(trimmed);
}

/** Lock address from CREATOR_PASS_LOCK_ADDRESS, falling back to the known pass. */
export function getCreatorPassLockAddress(): Address {
  const parsed = normalizeWalletAddress(process.env.CREATOR_PASS_LOCK_ADDRESS);
  return parsed ?? getAddress(CREATOR_PASS_LOCK_ADDRESS);
}

/** Chain id from CREATOR_PASS_CHAIN_ID; Base mainnet when unset or invalid. */
export function getCreatorPassChainId(): number {
  const raw = process.env.CREATOR_PASS_CHAIN_ID?.trim();
  if (!raw) {
    return CREATOR_PASS_CHAIN_ID;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : CREATOR_PASS_CHAIN_ID;
}

export type StudioMembershipAccess = "off" | "creator_pass";

/**
 * `ADAM_STUDIO_MEMBERSHIP_ACCESS`:
 *   - "off" (default): only the allowlist / Privy admins / Studio Key get in.
 *   - "creator_pass": any wallet holding a valid Creative Creator Pass gets in.
 */
export function getStudioMembershipAccessMode(): StudioMembershipAccess {
  const raw = process.env.ADAM_STUDIO_MEMBERSHIP_ACCESS?.trim().toLowerCase();
  return raw === "creator_pass" || raw === "members" ? "creator_pass" : "off";
}

export function isStudioMembershipAccessEnabled(): boolean {
  return getStudioMembershipAccessMode() === "creator_pass";
}

/**
 * Studio allowlist: owner defaults plus any comma-separated addresses in
 * ADAM_STUDIO_ALLOWED_WALLETS. Invalid entries are ignored (never throws).
 */
export function getStudioAllowlistedWallets(): Address[] {
  const out: Address[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const address = normalizeWalletAddress(raw);
    if (!address) {
      return;
    }
    const key = address.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(address);
  };

  for (const address of OWNER_STUDIO_WALLETS) {
    push(address);
  }
  for (const part of (process.env.ADAM_STUDIO_ALLOWED_WALLETS ?? "").split(",")) {
    push(part);
  }

  return out;
}

export function isStudioAllowlistedWallet(
  address: string | null | undefined,
  allowlist: readonly string[] = getStudioAllowlistedWallets(),
): boolean {
  const normalized = normalizeWalletAddress(address);
  if (!normalized) {
    return false;
  }
  const needle = normalized.toLowerCase();
  return allowlist.some((entry) => {
    const candidate = normalizeWalletAddress(entry);
    return candidate?.toLowerCase() === needle;
  });
}

export type StudioAccessGrant = {
  allowed: true;
  via: "owner" | "allowlist" | "creator_pass" | "studio_key";
  /** Wallet that satisfied membership/allowlist, when one did. */
  wallet: Address | null;
};

export type StudioAccessDenial = {
  allowed: false;
  reason: "signed_out" | "no_linked_wallet" | "not_a_member";
};

export type StudioAccessDecision = StudioAccessGrant | StudioAccessDenial;

export type StudioMembershipCheck = {
  address: Address;
  hasValidKey: boolean;
};

/**
 * Pure policy evaluation — no I/O, so it is easy to test and reuse for the
 * future per-member studio (where the granted wallet becomes the tenant key).
 */
export function evaluateStudioAccess(input: {
  isPrivyAdmin: boolean;
  wallets: readonly string[];
  allowlist?: readonly string[];
  membership?: readonly StudioMembershipCheck[];
}): StudioAccessDecision {
  if (input.isPrivyAdmin) {
    return { allowed: true, via: "owner", wallet: null };
  }

  const wallets: Address[] = [];
  for (const raw of input.wallets) {
    const address = normalizeWalletAddress(raw);
    if (address) {
      wallets.push(address);
    }
  }

  if (wallets.length === 0) {
    return { allowed: false, reason: "no_linked_wallet" };
  }

  const allowlist = input.allowlist ?? getStudioAllowlistedWallets();
  for (const wallet of wallets) {
    if (isStudioAllowlistedWallet(wallet, allowlist)) {
      return { allowed: true, via: "allowlist", wallet };
    }
  }

  for (const check of input.membership ?? []) {
    if (!check.hasValidKey) {
      continue;
    }
    const wallet = normalizeWalletAddress(check.address);
    if (wallet) {
      return { allowed: true, via: "creator_pass", wallet };
    }
  }

  return { allowed: false, reason: "not_a_member" };
}
