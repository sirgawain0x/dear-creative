/**
 * Master switch for Privy embedded-wallet gas sponsorship.
 *
 * Sponsorship is NOT granted by this flag alone: `resolveGasSponsorship` in
 * ./gas-sponsorship.ts only returns "sponsored" when a linked wallet holds an
 * active Creative Creator Pass. Non-members pay their own gas (ETH, or USDC via
 * the Alchemy ERC-20 policy on smart-account sends).
 */
export function isPrivyEmbeddedGasSponsorshipEnabled(): boolean {
  return process.env.PRIVY_EMBEDDED_GAS_SPONSORSHIP?.trim() === "true";
}
