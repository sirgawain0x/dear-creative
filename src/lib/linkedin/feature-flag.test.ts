import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLinkedInPostingEnabled,
  setLinkedInPostingEnabledForTests,
} from "./feature-flag";

describe("LinkedIn posting feature flag", () => {
  afterEach(() => {
    setLinkedInPostingEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("LINKEDIN_POSTING_ENABLED", "");
    expect(isLinkedInPostingEnabled()).toBe(false);
  });

  it("enables only when LINKEDIN_POSTING_ENABLED is true", () => {
    vi.stubEnv("LINKEDIN_POSTING_ENABLED", "true");
    expect(isLinkedInPostingEnabled()).toBe(true);
  });
});
