import { isPrivyAdminUserId } from "@/lib/privy/session-from-cookies";
import { resolvePrivySessionWithWallets } from "@/lib/privy/session-wallets";
import { readCreatorPassMemberships } from "./creator-pass";
import { isAdamApiToken } from "./require-auth";
import {
  ADAM_STUDIO_KEY_COOKIE,
  CREATOR_PASS_NAME,
  evaluateStudioAccess,
  getCreatorPassChainId,
  getCreatorPassLockAddress,
  getStudioAllowlistedWallets,
  getStudioMembershipAccessMode,
  normalizeWalletAddress,
  type StudioAccessDecision,
  type StudioMembershipAccess,
  type StudioMembershipCheck,
} from "./studio-access";

/**
 * Server-side Adam Studio gate.
 *
 * Resolution order lives in `evaluateStudioAccess`; this module adds the two
 * request-scoped inputs it needs: the Privy session (user + linked wallets)
 * and whether the caller presented a valid Studio Key.
 */

export type StudioMembershipSummary = {
  /** Whether the chain was queried at all for this request. */
  checked: boolean;
  /** Whether a valid Creator Pass was found (only meaningful when checked). */
  active: boolean;
  /** Wallet that satisfied membership, when one did. */
  wallet: string | null;
  lockAddress: string;
  lockName: string;
  chainId: number;
};

export type AdamStudioAccess = {
  decision: StudioAccessDecision;
  membership: StudioMembershipSummary;
};

type StudioSession = {
  privyUserId: string;
  linkedWalletAddresses: string[];
};

export function emptyMembershipSummary(
  overrides: Partial<StudioMembershipSummary> = {},
): StudioMembershipSummary {
  return {
    checked: false,
    active: false,
    wallet: null,
    lockAddress: getCreatorPassLockAddress(),
    lockName: CREATOR_PASS_NAME,
    chainId: getCreatorPassChainId(),
    ...overrides,
  };
}

/**
 * Evaluate access for one request. Injectable so tests (and future callers like
 * a per-member studio) don't need Privy or an RPC.
 */
export async function resolveAdamStudioAccess(input: {
  session: StudioSession | null;
  studioKey?: string | null;
  membershipAccess?: StudioMembershipAccess;
  allowlist?: readonly string[];
  readMembership?: (
    wallets: readonly string[],
  ) => Promise<StudioMembershipCheck[]>;
}): Promise<AdamStudioAccess> {
  const membershipAccess =
    input.membershipAccess ?? getStudioMembershipAccessMode();

  if (!input.session) {
    if (isAdamApiToken(input.studioKey ?? null)) {
      return {
        decision: { allowed: true, via: "studio_key", wallet: null },
        membership: emptyMembershipSummary(),
      };
    }
    return {
      decision: { allowed: false, reason: "signed_out" },
      membership: emptyMembershipSummary(),
    };
  }

  const { privyUserId, linkedWalletAddresses } = input.session;
  const allowlist = input.allowlist ?? getStudioAllowlistedWallets();

  const isPrivyAdmin = isPrivyAdminUserId(privyUserId);
  const wallets = linkedWalletAddresses.filter(
    (address) => normalizeWalletAddress(address) !== null,
  );

  // Studio Key works alongside a Privy session too (same trust as the API bearer).
  if (isAdamApiToken(input.studioKey ?? null)) {
    return {
      decision: { allowed: true, via: "studio_key", wallet: null },
      membership: emptyMembershipSummary(),
    };
  }

  const baseDecision = evaluateStudioAccess({
    isPrivyAdmin,
    wallets,
    allowlist,
  });
  if (baseDecision.allowed) {
    return { decision: baseDecision, membership: emptyMembershipSummary() };
  }

  if (membershipAccess !== "creator_pass" || wallets.length === 0) {
    return { decision: baseDecision, membership: emptyMembershipSummary() };
  }

  const readMembership =
    input.readMembership ?? ((addresses: readonly string[]) =>
      readCreatorPassMemberships(addresses, {
        lockAddress: getCreatorPassLockAddress(),
      }));

  let checks: StudioMembershipCheck[] = [];
  try {
    checks = await readMembership(wallets);
  } catch {
    checks = [];
  }

  const membershipDecision = evaluateStudioAccess({
    isPrivyAdmin,
    wallets,
    allowlist,
    membership: checks,
  });
  const activeWallet = checks.find((check) => check.hasValidKey)?.address ?? null;

  return {
    decision: membershipDecision,
    membership: emptyMembershipSummary({
      checked: true,
      active: membershipDecision.allowed,
      wallet: membershipDecision.allowed ? activeWallet : null,
    }),
  };
}

/** Cookies → Adam Studio access decision (the gate used by /adam). */
export async function resolveAdamStudioAccessFromCookies(
  readCookie: (name: string) => string | undefined,
): Promise<AdamStudioAccess> {
  const session = await resolvePrivySessionWithWallets(readCookie);
  return resolveAdamStudioAccess({
    session,
    studioKey: readCookie(ADAM_STUDIO_KEY_COOKIE) ?? null,
  });
}
