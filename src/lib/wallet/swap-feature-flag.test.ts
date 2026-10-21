import { afterEach, describe, expect, it, vi } from "vitest";
import { isWalletSwapEnabled, setWalletSwapEnabledForTests } from "./swap-feature-flag";

describe("isWalletSwapEnabled", () => {
  afterEach(() => {
    setWalletSwapEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("is false when unset", () => {
    delete process.env.WALLET_SWAP_ENABLED;
    expect(isWalletSwapEnabled()).toBe(false);
  });

  it("requires exact true", () => {
    vi.stubEnv("WALLET_SWAP_ENABLED", "TRUE");
    expect(isWalletSwapEnabled()).toBe(false);
    vi.stubEnv("WALLET_SWAP_ENABLED", "true");
    expect(isWalletSwapEnabled()).toBe(true);
  });
});
