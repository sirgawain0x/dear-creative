import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isReaderWalletE2eAuthEnabled,
  READER_WALLET_E2E_STORAGE_KEY,
} from "./reader-wallet-e2e-auth";

describe("isReaderWalletE2eAuthEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when NODE_ENV is production regardless of READER_WALLET_E2E_AUTH", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    vi.stubEnv("CI", "true");
    vi.stubEnv("READER_WALLET_ENABLED", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(false);
  });

  it("is false when VERCEL_ENV is production regardless of READER_WALLET_E2E_AUTH", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    vi.stubEnv("CI", "true");
    vi.stubEnv("READER_WALLET_ENABLED", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(false);
  });

  it("is false when both NODE_ENV and VERCEL_ENV are production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(false);
  });

  it("is true when READER_WALLET_E2E_AUTH is true in non-production deploy", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(true);
  });

  it("is true in CI when reader wallet is enabled without explicit e2e auth flag", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("CI", "true");
    vi.stubEnv("READER_WALLET_ENABLED", "true");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "");
    expect(isReaderWalletE2eAuthEnabled()).toBe(true);
  });

  it("is false in CI when reader wallet is disabled and e2e auth is not explicit", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("CI", "true");
    vi.stubEnv("READER_WALLET_ENABLED", "false");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "");
    expect(isReaderWalletE2eAuthEnabled()).toBe(false);
  });

  it("honors explicit READER_WALLET_E2E_AUTH in non-production even when reader wallet flag is off", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_ENABLED", "false");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "true");
    expect(isReaderWalletE2eAuthEnabled()).toBe(true);
  });

  it("is false when no enabling flags are set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_E2E_AUTH", "");
    vi.stubEnv("CI", "");
    expect(isReaderWalletE2eAuthEnabled()).toBe(false);
  });
});

describe("READER_WALLET_E2E_STORAGE_KEY", () => {
  it("is stable for playwright init scripts", () => {
    expect(READER_WALLET_E2E_STORAGE_KEY).toBe("dear_creative_reader_wallet_e2e");
  });
});
