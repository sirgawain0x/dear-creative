import { describe, expect, it } from "vitest";
import { POST_UNLOCK_PRICE_USDC_UNITS } from "./unlock-config";

describe("POST_UNLOCK_PRICE_USDC_UNITS", () => {
  it("is null so PR A does not imply a default per-post charge", () => {
    expect(POST_UNLOCK_PRICE_USDC_UNITS).toBeNull();
  });
});
