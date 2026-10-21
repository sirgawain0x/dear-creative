import { afterEach, describe, expect, it, vi } from "vitest";
import {
  postUnlockAmountRaw,
  postUnlockPriceUsdcUnits,
} from "./unlock-config";

describe("post unlock price config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when POST_UNLOCK_PRICE_USDC is unset", () => {
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "");
    expect(postUnlockPriceUsdcUnits()).toBeNull();
    expect(postUnlockAmountRaw()).toBeNull();
  });

  it("parses a positive USDC amount into 6-decimal raw units", () => {
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "1.5");
    expect(postUnlockPriceUsdcUnits()).toBe(1.5);
    expect(postUnlockAmountRaw()).toBe(BigInt(1_500000));
  });
});
