import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isReaderWalletE2eAuthEnabled,
  READER_WALLET_E2E_STORAGE_KEY,
} from "./reader-wallet-e2e-auth";

describe("isReaderWalletE2eAuthEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false on Vercel production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(false);
  });

  it("is true when READER_WALLET_E2E_AUTH is exactly true outside prod deploy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(true);
  });

  it("is true in CI when reader wallet is enabled", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("CI", "true");
    vi.stubEnv("READER_WALLET_ENABLED", "true");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "");
    expect(isReaderWalletE2eAuthEnabled()).toBe(true);
  });
});

describe("READER_WALLET_E2E_STORAGE_KEY", () => {
  it("is stable for playwright init scripts", () => {
    expect(READER_WALLET_E2E_STORAGE_KEY).toBe("dear_creative_reader_wallet_e2e");
  });
});
