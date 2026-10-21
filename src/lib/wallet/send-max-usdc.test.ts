import { afterEach, describe, expect, it, vi } from "vitest";
import { getWalletSendMaxUsdc } from "./send-max-usdc";

describe("getWalletSendMaxUsdc", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 100 when unset", () => {
    vi.stubEnv("WALLET_SEND_MAX_USDC", "");
    delete process.env.WALLET_SEND_MAX_USDC;
    expect(getWalletSendMaxUsdc()).toBe(100);
  });

  it("uses override when set", () => {
    vi.stubEnv("WALLET_SEND_MAX_USDC", "250");
    expect(getWalletSendMaxUsdc()).toBe(250);
  });
});
