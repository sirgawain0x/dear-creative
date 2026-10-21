import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetSwapEthUsdPriceForTests,
  setSwapEthUsdPriceForTests,
} from "./swap-eth-usd-price";
import { validateSwapRequestInput } from "./swap-validation";

describe("validateSwapRequestInput", () => {
  afterEach(() => {
    resetSwapEthUsdPriceForTests();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    setSwapEthUsdPriceForTests(async () => 2500);
  });

  it("rejects slippage above 2%", async () => {
    const result = await validateSwapRequestInput({
      direction: "USDC_TO_ETH",
      amount: "10",
      slippageBps: 250,
    });
    expect(result.ok).toBe(false);
  });

  it("enforces USDC notional cap with ETH price check", async () => {
    vi.stubEnv("WALLET_SWAP_MAX_USDC", "100");
    const result = await validateSwapRequestInput({
      direction: "ETH_TO_USDC",
      amount: "0.05",
      slippageBps: 50,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid USDC swap", async () => {
    const result = await validateSwapRequestInput({
      direction: "USDC_TO_ETH",
      amount: "10",
    });
    expect(result.ok).toBe(true);
  });
});
