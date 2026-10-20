import { base, baseSepolia } from "viem/chains";

export type OracleNetworkId = "base" | "base-sepolia";

export function resolveOracleNetworkId(): OracleNetworkId {
  const raw = process.env.ORACLE_NETWORK?.trim().toLowerCase();
  if (raw === "base-sepolia" || raw === "sepolia") {
    return "base-sepolia";
  }
  return "base";
}

export function resolveOracleChain() {
  return resolveOracleNetworkId() === "base-sepolia" ? baseSepolia : base;
}

export function resolveOracleRpcUrl(): string {
  const isSepolia = resolveOracleNetworkId() === "base-sepolia";
  const alchemyKey = process.env.ALCHEMY_API_KEY?.trim();
  if (alchemyKey) {
    return `https://${isSepolia ? "base-sepolia" : "base-mainnet"}.g.alchemy.com/v2/${alchemyKey}`;
  }
  return isSepolia ? "https://sepolia.base.org" : "https://mainnet.base.org";
}
