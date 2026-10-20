import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCowritersEnabled,
  setCowritersEnabledForTests,
} from "./feature-flag";

describe("isCowritersEnabled", () => {
  afterEach(() => {
    setCowritersEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    vi.stubEnv("COWRITERS_ENABLED", "");
    expect(isCowritersEnabled()).toBe(false);
  });

  it("reads COWRITERS_ENABLED=true", () => {
    vi.stubEnv("COWRITERS_ENABLED", "true");
    expect(isCowritersEnabled()).toBe(true);
  });

  it("respects test override", () => {
    setCowritersEnabledForTests(true);
    expect(isCowritersEnabled()).toBe(true);
  });
});
