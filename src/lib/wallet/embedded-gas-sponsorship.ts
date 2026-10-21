/** When true, client passes `sponsor: true` to Privy useSendTransaction (requires dashboard gas sponsorship). */
export function isPrivyEmbeddedGasSponsorshipEnabled(): boolean {
  return process.env.PRIVY_EMBEDDED_GAS_SPONSORSHIP?.trim() === "true";
}
