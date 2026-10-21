import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isReaderWalletEnabled,
  setReaderWalletEnabledForTests,
} from "./reader-wallet-feature-flag";

describe("isReaderWalletEnabled", () => {
  afterEach(() => {
    setReaderWalletEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("is false when unset", () => {
    vi.stubEnv("READER_WALLET_ENABLED", "");
    expect(isReaderWalletEnabled()).toBe(false);
  });

  it("is false for truthy non-exact values", () => {
    vi.stubEnv("READER_WALLET_ENABLED", "TRUE");
    expect(isReaderWalletEnabled()).toBe(false);
    vi.stubEnv("READER_WALLET_ENABLED", "1");
    expect(isReaderWalletEnabled()).toBe(false);
  });

  it("is true only for exactly true", () => {
    vi.stubEnv("READER_WALLET_ENABLED", "true");
    expect(isReaderWalletEnabled()).toBe(true);
  });

  it("honors test override", () => {
    setReaderWalletEnabledForTests(true);
    expect(isReaderWalletEnabled()).toBe(true);
  });
});
