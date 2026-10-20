import { describe, expect, it } from "vitest";
import { computeWriterGroupKey } from "./group-key";

describe("computeWriterGroupKey", () => {
  it("is order-independent after sorting wallet:bps pairs", () => {
    const a = computeWriterGroupKey([
      { wallet: "0xAbC", shareBps: 5000 },
      { wallet: "0xdef", shareBps: 5000 },
    ]);
    const b = computeWriterGroupKey([
      { wallet: "0xDEF", shareBps: 5000 },
      { wallet: "0xabc", shareBps: 5000 },
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when share bps differ", () => {
    const left = computeWriterGroupKey([
      { wallet: "0x111", shareBps: 6000 },
      { wallet: "0x222", shareBps: 4000 },
    ]);
    const right = computeWriterGroupKey([
      { wallet: "0x111", shareBps: 5000 },
      { wallet: "0x222", shareBps: 5000 },
    ]);
    expect(left).not.toBe(right);
  });

  it("rejects empty or invalid pairs", () => {
    expect(() => computeWriterGroupKey([])).toThrow(/empty/);
    expect(() =>
      computeWriterGroupKey([{ wallet: "  ", shareBps: 100 }]),
    ).toThrow(/wallet/);
  });
});
