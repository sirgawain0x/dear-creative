import { describe, expect, it } from "vitest";
import { WRITER_SHARE_BPS_TOTAL } from "./constants";
import { equalWriterShareBps } from "./share-math";

describe("equalWriterShareBps", () => {
  it("returns a single full share for one participant", () => {
    expect(equalWriterShareBps(1)).toEqual([WRITER_SHARE_BPS_TOTAL]);
  });

  it("splits evenly when 10_000 divides participant count", () => {
    expect(equalWriterShareBps(4)).toEqual([2500, 2500, 2500, 2500]);
  });

  it("assigns remainder bps to lowest indices deterministically", () => {
    expect(equalWriterShareBps(3)).toEqual([3334, 3333, 3333]);
    expect(equalWriterShareBps(7)).toEqual([1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  });

  it("always sums to WRITER_SHARE_BPS_TOTAL", () => {
    for (let n = 1; n <= 10; n += 1) {
      const shares = equalWriterShareBps(n);
      expect(shares.reduce((sum, bps) => sum + bps, 0)).toBe(
        WRITER_SHARE_BPS_TOTAL,
      );
    }
  });

  it("rejects invalid participant counts", () => {
    expect(() => equalWriterShareBps(0)).toThrow(/positive integer/);
    expect(() => equalWriterShareBps(1.5)).toThrow(/positive integer/);
  });
});
