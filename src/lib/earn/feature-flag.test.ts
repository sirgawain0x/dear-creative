import { afterEach, describe, expect, it, vi } from "vitest";
import { isEarnEnabled, setEarnEnabledForTests } from "./feature-flag";

describe("earn feature flag", () => {
  afterEach(() => {
    setEarnEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("EARN_ENABLED", "");
    expect(isEarnEnabled()).toBe(false);
  });

  it("enables only when EARN_ENABLED is exactly true", () => {
    vi.stubEnv("EARN_ENABLED", "true");
    expect(isEarnEnabled()).toBe(true);
    vi.stubEnv("EARN_ENABLED", "TRUE");
    expect(isEarnEnabled()).toBe(false);
  });
});
