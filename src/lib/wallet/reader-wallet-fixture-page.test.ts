import { afterEach, describe, expect, it, vi } from "vitest";
import { isReaderWalletFixturePageEnabled } from "./reader-wallet-fixture-page";

describe("isReaderWalletFixturePageEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true in production NODE_ENV when READER_WALLET_FIXTURE=true (CI playwright)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_FIXTURE", "true");
    expect(isReaderWalletFixturePageEnabled()).toBe(true);
  });

  it("is false in production NODE_ENV without fixture flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_FIXTURE", "");
    expect(isReaderWalletFixturePageEnabled()).toBe(false);
  });

  it("is false on Vercel production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isReaderWalletFixturePageEnabled()).toBe(false);
  });

  it("is true in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isReaderWalletFixturePageEnabled()).toBe(true);
  });

  it("is true on non-dev hosts when READER_WALLET_FIXTURE=true", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_FIXTURE", "true");
    expect(isReaderWalletFixturePageEnabled()).toBe(true);
  });

  it("is false on non-dev hosts without flag", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isReaderWalletFixturePageEnabled()).toBe(false);
  });

  it("is false when READER_WALLET_FIXTURE is not exactly true", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("READER_WALLET_FIXTURE", "TRUE");
    expect(isReaderWalletFixturePageEnabled()).toBe(false);
  });
});
