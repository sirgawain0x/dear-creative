import { afterEach, describe, expect, it, vi } from "vitest";
import { base, baseSepolia } from "viem/chains";
import {
  resolveOracleChain,
  resolveOracleNetworkId,
  resolveOracleRpcUrl,
} from "./oracle-chain";

describe("oracle chain config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Base mainnet without X402 env coupling", () => {
    vi.stubEnv("X402_NETWORK", "base-sepolia");
    vi.stubEnv("ORACLE_NETWORK", "");
    expect(resolveOracleNetworkId()).toBe("base");
    expect(resolveOracleChain().id).toBe(base.id);
  });

  it("honors ORACLE_NETWORK=base-sepolia", () => {
    vi.stubEnv("ORACLE_NETWORK", "base-sepolia");
    expect(resolveOracleNetworkId()).toBe("base-sepolia");
    expect(resolveOracleChain().id).toBe(baseSepolia.id);
    expect(resolveOracleRpcUrl()).toContain("sepolia");
  });
});
