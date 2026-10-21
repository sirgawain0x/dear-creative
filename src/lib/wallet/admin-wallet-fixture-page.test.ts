import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminWalletFixturePageEnabled } from "./admin-wallet-fixture-page";

describe("isAdminWalletFixturePageEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false in NODE_ENV production even with ADMIN_WALLET_FIXTURE=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_WALLET_FIXTURE", "true");
    expect(isAdminWalletFixturePageEnabled()).toBe(false);
  });

  it("returns false when VERCEL_ENV is production even with ADMIN_WALLET_FIXTURE=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ADMIN_WALLET_FIXTURE", "true");
    expect(isAdminWalletFixturePageEnabled()).toBe(false);
  });

  it("returns true in local development without ADMIN_WALLET_FIXTURE", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_WALLET_FIXTURE", "");
    expect(isAdminWalletFixturePageEnabled()).toBe(true);
  });

  it("returns true on non-dev NODE_ENV when ADMIN_WALLET_FIXTURE=true", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ADMIN_WALLET_FIXTURE", "true");
    expect(isAdminWalletFixturePageEnabled()).toBe(true);
  });

  it("returns false on non-dev NODE_ENV without ADMIN_WALLET_FIXTURE", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADMIN_WALLET_FIXTURE", "");
    expect(isAdminWalletFixturePageEnabled()).toBe(false);
  });
});
