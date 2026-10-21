import { describe, expect, it } from "vitest";
import { basescanAddressUrl, formatChecksumAddress } from "./payout-address";

describe("formatChecksumAddress", () => {
  it("returns checksummed address", () => {
    const mixed = "0xf46f1ba19a9280f752a451d0973b047d81c63d70";
    const formatted = formatChecksumAddress(mixed);
    expect(formatted).toBe("0xf46F1BA19A9280F752a451d0973b047D81c63D70");
  });

  it("returns null for empty values", () => {
    expect(formatChecksumAddress(null)).toBeNull();
    expect(formatChecksumAddress("")).toBeNull();
  });
});

describe("basescanAddressUrl", () => {
  it("builds basescan link", () => {
    expect(basescanAddressUrl("0xAbC")).toBe("https://basescan.org/address/0xAbC");
  });
});
