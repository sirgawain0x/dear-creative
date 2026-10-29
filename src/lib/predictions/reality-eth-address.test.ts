import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REALITY_ETH_BASE_MAINNET,
  resolveRealityEthContractAddress,
} from "./reality-eth-address";

describe("reality-eth-address", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to crtv3 Reality.eth 3.0 Base address", () => {
    expect(REALITY_ETH_BASE_MAINNET).toBe(
      "0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8",
    );
    expect(resolveRealityEthContractAddress()).toBe(REALITY_ETH_BASE_MAINNET);
  });

  it("honors REALITY_ETH_ADDRESS override", () => {
    vi.stubEnv(
      "REALITY_ETH_ADDRESS",
      "0x446e545A6d0429718429B57c9135061413a2F44a",
    );
    expect(resolveRealityEthContractAddress()).toBe(
      "0x446e545A6d0429718429B57c9135061413a2F44a",
    );
  });
});
