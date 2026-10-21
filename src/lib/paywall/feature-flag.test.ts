import { afterEach, describe, expect, it, vi } from "vitest";
import { isPaywallEnabled, setPaywallEnabledForTests } from "./feature-flag";

describe("isPaywallEnabled", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    delete process.env.PAYWALL_ENABLED;
    expect(isPaywallEnabled()).toBe(false);
  });

  it("is false for truthy values other than the literal true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "TRUE");
    expect(isPaywallEnabled()).toBe(false);
  });

  it("is true only when PAYWALL_ENABLED is exactly true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "true");
    expect(isPaywallEnabled()).toBe(true);
  });

  it("respects test override", () => {
    setPaywallEnabledForTests(true);
    expect(isPaywallEnabled()).toBe(true);
  });
});
