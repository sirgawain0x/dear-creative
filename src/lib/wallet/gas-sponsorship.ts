import { getAddress, isAddress, type Address } from "viem";
import { readCreatorPassMembership } from "@/lib/adam/creator-pass";
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
} from "@/lib/payments/subscription-config";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { resolvePrivySessionWithWallets } from "@/lib/privy/session-wallets";

/**
 * Gas payment policy for Dear Creative.
 *
 * Free (sponsored) gas is reserved for active Creative Creator Pass holders.
 * Everyone else pays their own gas. The Alchemy Gas Manager ERC-20 policy
 * (ALCHEMY_ERC20_GAS_POLICY_ID) lets a smart-account send charge that gas in
 * USDC instead of ETH — see docs/gas-sponsorship.md for the wallet model.
 */

/** Master switch: nothing is sponsored unless this is exactly "true". */
export function isGasSponsorshipEnabled(): boolean {
  return process.env.PRIVY_EMBEDDED_GAS_SPONSORSHIP?.trim() === "true";
}

/** Alchemy Gas Manager ERC-20 policy id (pay gas in USDC). */
export function getErc20GasPolicyId(): string | null {
  const raw = process.env.ALCHEMY_ERC20_GAS_POLICY_ID?.trim();
  return raw ? raw : null;
}

export type GasSponsorshipReason =
  | "creator_pass"
  | "no_pass"
  | "signed_out"
  | "disabled";

export type Erc20GasConfig = {
  policyId: string | null;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: "USDC";
};

export type GasSponsorshipDecision = {
  /** "sponsored" = the app pays; "self_paid" = the user pays. */
  mode: "sponsored" | "self_paid";
  reason: GasSponsorshipReason;
  /** Wallet that earned sponsorship, when one did. */
  wallet: string | null;
  /** ERC-20 gas payment config, for smart-account sends (USDC on Base). */
  erc20: Erc20GasConfig;
};

const USDC_ON_BASE = getAddress(BASE_USDC_ADDRESS);

export function getErc20GasConfig(): Erc20GasConfig {
  return {
    policyId: getErc20GasPolicyId(),
    chainId: BASE_CHAIN_ID,
    tokenAddress: USDC_ON_BASE,
    tokenSymbol: "USDC",
  };
}

function normalizeAddress(raw: string | null | undefined): Address | null {
  const trimmed = raw?.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  return getAddress(trimmed);
}

export function selfPaidDecision(
  reason: GasSponsorshipReason,
): GasSponsorshipDecision {
  return {
    mode: "self_paid",
    reason,
    wallet: null,
    erc20: getErc20GasConfig(),
  };
}

export type GasMembershipReader = (wallet: Address) => Promise<boolean>;

/**
 * Sponsored only when one linked wallet holds a valid pass.
 * Fail-closed — a chain error resolves to self-paid.
 */
export async function resolveGasSponsorship(input: {
  wallets: readonly string[];
  readMembership?: GasMembershipReader;
}): Promise<GasSponsorshipDecision> {
  if (!isGasSponsorshipEnabled()) {
    return selfPaidDecision("disabled");
  }

  const wallets = input.wallets
    .map(normalizeAddress)
    .filter((wallet): wallet is Address => wallet !== null);

  if (wallets.length === 0) {
    return selfPaidDecision("signed_out");
  }

  const readMembership: GasMembershipReader =
    input.readMembership ??
    (async (wallet) =>
      (await readCreatorPassMembership(wallet))?.hasValidKey ?? false);

  for (const wallet of wallets) {
    let hasValidKey = false;
    try {
      hasValidKey = await readMembership(wallet);
    } catch {
      hasValidKey = false;
    }
    if (hasValidKey) {
      return {
        mode: "sponsored",
        reason: "creator_pass",
        wallet,
        erc20: getErc20GasConfig(),
      };
    }
  }

  return selfPaidDecision("no_pass");
}

/** Cookies → gas decision for the signed-in viewer. */
export async function resolveGasSponsorshipFromCookies(
  readCookie: (name: string) => string | undefined,
): Promise<GasSponsorshipDecision> {
  if (!isGasSponsorshipEnabled()) {
    return selfPaidDecision("disabled");
  }
  const session = await resolvePrivySessionWithWallets(readCookie);
  if (!session) {
    return selfPaidDecision("signed_out");
  }
  return resolveGasSponsorship({ wallets: session.linkedWalletAddresses });
}

/** Bearer token → gas decision (API route callers). */
export async function resolveGasSponsorshipFromAuthorization(
  authorizationHeader: string | null,
): Promise<GasSponsorshipDecision> {
  if (!isGasSponsorshipEnabled()) {
    return selfPaidDecision("disabled");
  }
  const wallets =
    (await resolvePrivyLinkedChecksumWalletAddresses(authorizationHeader)) ?? [];
  if (wallets.length === 0) {
    return selfPaidDecision("signed_out");
  }
  return resolveGasSponsorship({ wallets });
}
