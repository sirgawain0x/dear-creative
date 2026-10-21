import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminPayoutsFixtureEnabled } from "./payouts-fixture";

describe("isAdminPayoutsFixtureEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false in production", () => {
    vi.stubEnv("ADMIN_PAYOUTS_FIXTURE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAdminPayoutsFixtureEnabled()).toBe(false);
  });

  it("returns true in development when flag is set", () => {
    vi.stubEnv("ADMIN_PAYOUTS_FIXTURE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isAdminPayoutsFixtureEnabled()).toBe(true);
  });
});
