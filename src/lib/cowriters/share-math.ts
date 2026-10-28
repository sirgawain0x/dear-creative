import { WRITER_SHARE_BPS_TOTAL } from "./constants";

/**
 * Split `WRITER_SHARE_BPS_TOTAL` (10_000 bps) equally across `participantCount`
 * slots. Remainder bps are distributed one at a time to the lowest indices so
 * the result is deterministic and sums to exactly 10_000.
 */
export function equalWriterShareBps(participantCount: number): number[] {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new Error("participantCount must be a positive integer");
  }
  const base = Math.floor(WRITER_SHARE_BPS_TOTAL / participantCount);
  let remainder = WRITER_SHARE_BPS_TOTAL - base * participantCount;
  const shares: number[] = [];
  for (let i = 0; i < participantCount; i += 1) {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) {
      remainder -= 1;
    }
    shares.push(base + extra);
  }
  return shares;
}
