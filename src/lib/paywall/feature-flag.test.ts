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

  it("is true only when value is exactly true", () => {
    vi.stubEnv("PAYWALL_ENABLED", "true");
    expect(isPaywallEnabled()).toBe(true);
  });

  it("respects test override", () => {
    setPaywallEnabledForTests(true);
    expect(isPaywallEnabled()).toBe(true);
  });
});
