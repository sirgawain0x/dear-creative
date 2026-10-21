import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_POST_UNLOCK_PRICE_USDC,
  postUnlockAmountRaw,
  postUnlockPriceUsdcUnits,
} from "./unlock-config";

describe("post unlock price config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 1 USDC when POST_UNLOCK_PRICE_USDC is unset", () => {
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "");
    expect(postUnlockPriceUsdcUnits()).toBe(DEFAULT_POST_UNLOCK_PRICE_USDC);
    expect(postUnlockAmountRaw()).toBe(BigInt(1_000000));
  });

  it("uses POST_UNLOCK_PRICE_USDC when set to a valid positive decimal", () => {
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "2.25");
    expect(postUnlockPriceUsdcUnits()).toBe(2.25);
    expect(postUnlockAmountRaw()).toBe(BigInt(2_250000));
  });

  it("falls back to 1 USDC for invalid values", () => {
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "-3");
    expect(postUnlockPriceUsdcUnits()).toBe(1);
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "0");
    expect(postUnlockPriceUsdcUnits()).toBe(1);
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "1.1234567");
    expect(postUnlockPriceUsdcUnits()).toBe(1);
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "not-a-price");
    expect(postUnlockPriceUsdcUnits()).toBe(1);
  });
});
