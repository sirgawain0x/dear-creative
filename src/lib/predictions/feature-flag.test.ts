import { afterEach, describe, expect, it, vi } from "vitest";
import { isOracleEnabled, setOracleEnabledForTests } from "./feature-flag";

describe("isOracleEnabled", () => {
  afterEach(() => {
    setOracleEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    vi.stubEnv("ORACLE_ENABLED", "");
    expect(isOracleEnabled()).toBe(false);
  });

  it("returns true when ORACLE_ENABLED=true", () => {
    vi.stubEnv("ORACLE_ENABLED", "true");
    expect(isOracleEnabled()).toBe(true);
  });

  it("respects test override", () => {
    setOracleEnabledForTests(true);
    expect(isOracleEnabled()).toBe(true);
  });
});
