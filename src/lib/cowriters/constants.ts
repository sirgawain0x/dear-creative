/** Maximum co-writer slots per post (excluding the primary author). */
export const MAX_COWRITERS_PER_POST = 5;

/**
 * Revenue share denominator for post writers (100% = 10_000 bps).
 * Remainders from equal splits are assigned in stable index order (+1 bps each).
 */
export const WRITER_SHARE_BPS_TOTAL = 10_000;
