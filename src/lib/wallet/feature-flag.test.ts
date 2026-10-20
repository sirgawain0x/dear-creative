import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isWalletEnabled,
  setWalletEnabledForTests,
} from "./feature-flag";

describe("wallet feature flag", () => {
  afterEach(() => {
    setWalletEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("WALLET_ENABLED", "");
    expect(isWalletEnabled()).toBe(false);
  });

  it("enables only when WALLET_ENABLED is true", () => {
    vi.stubEnv("WALLET_ENABLED", "true");
    expect(isWalletEnabled()).toBe(true);
  });
});
