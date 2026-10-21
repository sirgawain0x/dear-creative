import { getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sealSwapQuote, verifySwapQuoteSeal } from "./swap-quote-seal";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

describe("swap quote seal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("seals and verifies quote payloads", () => {
    vi.stubEnv("ALCHEMY_API_KEY", "test-hmac-key");
    const payload = {
      from: ADMIN,
      direction: "USDC_TO_ETH" as const,
      amount: "5",
      slippageBps: 50,
      expiry: "2099-01-01T00:00:00.000Z",
      fromAmount: "0x5f5e100",
      minimumToAmount: "0x4c4b400",
    };
    const seal = sealSwapQuote(payload);
    expect(seal).toBeTruthy();
    expect(verifySwapQuoteSeal(seal, payload)).toBe(true);
    expect(verifySwapQuoteSeal(seal, { ...payload, amount: "6" })).toBe(false);
  });
});
