import { describe, expect, it } from "vitest";
import {
  computeEarnedYieldRaw,
  formatApyBps,
  formatTokenAmountFromRaw,
  isBaseUsdcVault,
} from "./format";

describe("earn format helpers", () => {
  it("formats APY basis points as percent without float math", () => {
    expect(formatApyBps(500)).toBe("5%");
    expect(formatApyBps(425)).toBe("4.25%");
  });

  it("formats 6-decimal token amounts", () => {
    expect(formatTokenAmountFromRaw("1050000", 6)).toBe("1.05");
    expect(formatTokenAmountFromRaw("850000000", 6)).toBe("850");
  });

  it("computes earned yield in raw units", () => {
    const yieldRaw = computeEarnedYieldRaw(
      850_000_000n,
      1_000_000_000n,
      200_000_000n,
    );
    expect(yieldRaw).toBe(50_000_000n);
    expect(formatTokenAmountFromRaw(yieldRaw.toString(), 6)).toBe("50");
  });

  it("detects Base USDC vaults", () => {
    expect(
      isBaseUsdcVault({ caip2: "eip155:8453", symbol: "usdc" }),
    ).toBe(true);
    expect(
      isBaseUsdcVault({ caip2: "eip155:1", symbol: "usdc" }),
    ).toBe(false);
  });
});
