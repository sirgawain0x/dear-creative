import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isWalletSendEnabled,
  setWalletSendEnabledForTests,
} from "./send-feature-flag";

describe("isWalletSendEnabled", () => {
  afterEach(() => {
    setWalletSendEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    vi.stubEnv("WALLET_SEND_ENABLED", "");
    expect(isWalletSendEnabled()).toBe(false);
  });

  it("is false for truthy non-true values", () => {
    vi.stubEnv("WALLET_SEND_ENABLED", "TRUE");
    expect(isWalletSendEnabled()).toBe(false);
    vi.stubEnv("WALLET_SEND_ENABLED", "1");
    expect(isWalletSendEnabled()).toBe(false);
  });

  it("is true only when value is exactly true", () => {
    vi.stubEnv("WALLET_SEND_ENABLED", "true");
    expect(isWalletSendEnabled()).toBe(true);
  });

  it("respects test override", () => {
    setWalletSendEnabledForTests(true);
    expect(isWalletSendEnabled()).toBe(true);
  });
});
