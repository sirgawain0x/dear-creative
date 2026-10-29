/**
 * Reality.eth 3.0 on Base — contract address aligned with sirgawain0x/crtv3
 * (`lib/sdk/reality-eth/reality-eth-client.ts`, Base hardcoded config).
 */
export const REALITY_ETH_BASE_MAINNET =
  "0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8" as const;

/** Resolved Reality.eth contract (env override preserved for oracle + embed reads). */
export function resolveRealityEthContractAddress(): `0x${string}` {
  const override = process.env.REALITY_ETH_ADDRESS?.trim();
  if (override) {
    return override as `0x${string}`;
  }
  return REALITY_ETH_BASE_MAINNET;
}
