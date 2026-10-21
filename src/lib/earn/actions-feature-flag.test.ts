import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isEarnActionsEnabled,
  setEarnActionsEnabledForTests,
} from "./actions-feature-flag";

describe("earn actions feature flag", () => {
  afterEach(() => {
    setEarnActionsEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("EARN_ACTIONS_ENABLED", "");
    expect(isEarnActionsEnabled()).toBe(false);
  });

  it("enables only when exactly true", () => {
    vi.stubEnv("EARN_ACTIONS_ENABLED", "true");
    expect(isEarnActionsEnabled()).toBe(true);
    vi.stubEnv("EARN_ACTIONS_ENABLED", "TRUE");
    expect(isEarnActionsEnabled()).toBe(false);
  });
});
