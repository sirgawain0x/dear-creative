import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPreviewLinksEnabled,
  setPreviewLinksEnabledForTests,
} from "./feature-flag";

describe("PREVIEW_LINKS_ENABLED", () => {
  afterEach(() => {
    setPreviewLinksEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("is off by default", () => {
    vi.stubEnv("PREVIEW_LINKS_ENABLED", "");
    expect(isPreviewLinksEnabled()).toBe(false);
  });

  it("enables only when PREVIEW_LINKS_ENABLED is true", () => {
    vi.stubEnv("PREVIEW_LINKS_ENABLED", "true");
    expect(isPreviewLinksEnabled()).toBe(true);
    vi.stubEnv("PREVIEW_LINKS_ENABLED", "TRUE");
    expect(isPreviewLinksEnabled()).toBe(false);
  });
});
