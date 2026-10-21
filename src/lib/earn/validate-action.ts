import { EARN_ACTION_MAX_RAW_AMOUNT } from "./actions-limits";
import { isKnownEarnVaultId } from "./vaults";

export type EarnActionDirection = "deposit" | "withdraw";

export type ValidateEarnActionInput = {
  vaultId: string;
  rawAmount: bigint;
  direction: EarnActionDirection;
  walletUsdcBalanceRaw: bigint;
  assetsInVaultRaw: bigint;
  availableLiquidityUsd: number | null;
};

export type ValidateEarnActionResult =
  | { ok: true }
  | { ok: false; code: string };

export function parseRawAmountString(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export function liquidityUsdToUsdcRaw(usd: number | null): bigint {
  if (usd === null || !Number.isFinite(usd) || usd <= 0) {
    return BigInt(0);
  }
  return BigInt(Math.trunc(usd)) * BigInt(1_000_000);
}

export function validateEarnActionRequest(
  input: ValidateEarnActionInput,
): ValidateEarnActionResult {
  if (!isKnownEarnVaultId(input.vaultId)) {
    return { ok: false, code: "invalid_vault" };
  }
  if (input.rawAmount <= BigInt(0)) {
    return { ok: false, code: "invalid_amount" };
  }
  if (input.rawAmount > EARN_ACTION_MAX_RAW_AMOUNT) {
    return { ok: false, code: "amount_exceeds_cap" };
  }

  if (input.direction === "deposit") {
    if (input.rawAmount > input.walletUsdcBalanceRaw) {
      return { ok: false, code: "insufficient_balance" };
    }
    return { ok: true };
  }

  if (input.rawAmount > input.assetsInVaultRaw) {
    return { ok: false, code: "insufficient_vault_position" };
  }
  const liquidityRaw = liquidityUsdToUsdcRaw(input.availableLiquidityUsd);
  if (liquidityRaw > BigInt(0) && input.rawAmount > liquidityRaw) {
    return { ok: false, code: "insufficient_liquidity" };
  }
  return { ok: true };
}
