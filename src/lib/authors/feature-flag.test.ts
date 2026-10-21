import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAuthorProfilesEnabled,
  setAuthorProfilesEnabledForTests,
} from "./feature-flag";

describe("isAuthorProfilesEnabled", () => {
  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    vi.stubEnv("AUTHOR_PROFILES_ENABLED", "");
    expect(isAuthorProfilesEnabled()).toBe(false);
  });

  it("is false for truthy non-true values", () => {
    vi.stubEnv("AUTHOR_PROFILES_ENABLED", "TRUE");
    expect(isAuthorProfilesEnabled()).toBe(false);
    vi.stubEnv("AUTHOR_PROFILES_ENABLED", "1");
    expect(isAuthorProfilesEnabled()).toBe(false);
  });

  it("is true only when value is exactly true", () => {
    vi.stubEnv("AUTHOR_PROFILES_ENABLED", "true");
    expect(isAuthorProfilesEnabled()).toBe(true);
  });

  it("respects test override", () => {
    setAuthorProfilesEnabledForTests(true);
    expect(isAuthorProfilesEnabled()).toBe(true);
  });
});
