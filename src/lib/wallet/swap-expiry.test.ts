import { describe, expect, it } from "vitest";
import { isQuoteNearOrPastExpiry } from "./swap-expiry";

describe("isQuoteNearOrPastExpiry", () => {
  it("detects expired quotes", () => {
    expect(isQuoteNearOrPastExpiry("2000-01-01T00:00:00.000Z", Date.now())).toBe(
      true,
    );
  });

  it("detects quotes expiring within the buffer window", () => {
    const soon = new Date(Date.now() + 5_000).toISOString();
    expect(isQuoteNearOrPastExpiry(soon, Date.now() + 15_000)).toBe(true);
  });
});
