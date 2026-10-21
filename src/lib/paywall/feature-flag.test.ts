import { afterEach, describe, expect, it, vi } from "vitest";
import { isPaywallEnabled, setPaywallEnabledForTests } from "./feature-flag";

describe("isPaywallEnabled", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    vi.stubEnv("PAYWALL_ENABLED", "");
    expect(isPaywallEnabled()).toBe(false);
  });

  it("is false for truthy non-true values", () => {
    vi.stubEnv("PAYWALL_ENABLED", "TRUE");
    expect(isPaywallEnabled()).toBe(false);
    vi.stubEnv("PAYWALL_ENABLED", "1");
    expect(isPaywallEnabled()).toBe(false);
  });

  it("is true only when PAYWALL_ENABLED and PAYMENTS_ENABLED are exactly true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "true");
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect(isPaywallEnabled()).toBe(true);
  });

  it("is false when only PAYWALL_ENABLED is true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "true");
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    expect(isPaywallEnabled()).toBe(false);
  });

  it("is false when only PAYMENTS_ENABLED is true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "false");
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect(isPaywallEnabled()).toBe(false);
  });

  it("is false when PAYMENTS_ENABLED is truthy but not exactly true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "true");
    vi.stubEnv("PAYMENTS_ENABLED", "TRUE");
    expect(isPaywallEnabled()).toBe(false);
  });

  it("respects test override", () => {
    setPaywallEnabledForTests(true);
    expect(isPaywallEnabled()).toBe(true);
  });
});
