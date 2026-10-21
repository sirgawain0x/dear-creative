import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isRepurposePricingConfigured,
  setRepurposePricingForTests,
} from "./feature-flag";

describe("isRepurposePricingConfigured", () => {
  afterEach(() => {
    setRepurposePricingForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("defaults to false when unset", () => {
    vi.stubEnv("REPURPOSE_PRICING", "");
    expect(isRepurposePricingConfigured()).toBe(false);
  });

  it("respects test override", () => {
    setRepurposePricingForTests(true);
    expect(isRepurposePricingConfigured()).toBe(true);
  });
});
