import { describe, expect, it } from "vitest";
import { shortenAddress } from "./short-address";

describe("shortenAddress", () => {
  it("shortens a standard hex address", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234…5678",
    );
  });
});
