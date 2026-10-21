import { describe, expect, it } from "vitest";
import { EARN_VAULT_AAVE_ID } from "./vaults";
import { validateEarnActionRequest } from "./validate-action";

describe("validateEarnActionRequest", () => {
  it("rejects unknown vault ids", () => {
    const result = validateEarnActionRequest({
      vaultId: "unknown",
      rawAmount: BigInt(1),
      direction: "deposit",
      walletUsdcBalanceRaw: BigInt(100),
      assetsInVaultRaw: BigInt(0),
      availableLiquidityUsd: 100,
    });
    expect(result).toEqual({ ok: false, code: "invalid_vault" });
  });

  it("enforces deposit balance and cap", () => {
    expect(
      validateEarnActionRequest({
        vaultId: EARN_VAULT_AAVE_ID,
        rawAmount: BigInt(2_000_000_000),
        direction: "deposit",
        walletUsdcBalanceRaw: BigInt(1_000_000),
        assetsInVaultRaw: BigInt(0),
        availableLiquidityUsd: null,
      }).ok,
    ).toBe(false);

    expect(
      validateEarnActionRequest({
        vaultId: EARN_VAULT_AAVE_ID,
        rawAmount: BigInt(1_000_000),
        direction: "deposit",
        walletUsdcBalanceRaw: BigInt(2_000_000),
        assetsInVaultRaw: BigInt(0),
        availableLiquidityUsd: null,
      }),
    ).toEqual({ ok: true });
  });

  it("enforces withdraw liquidity and position", () => {
    expect(
      validateEarnActionRequest({
        vaultId: EARN_VAULT_AAVE_ID,
        rawAmount: BigInt(5_000_000),
        direction: "withdraw",
        walletUsdcBalanceRaw: BigInt(0),
        assetsInVaultRaw: BigInt(10_000_000),
        availableLiquidityUsd: 2,
      }).ok,
    ).toBe(false);

    expect(
      validateEarnActionRequest({
        vaultId: EARN_VAULT_AAVE_ID,
        rawAmount: BigInt(1_000_000),
        direction: "withdraw",
        walletUsdcBalanceRaw: BigInt(0),
        assetsInVaultRaw: BigInt(5_000_000),
        availableLiquidityUsd: 100,
      }).ok,
    ).toBe(true);
  });
});
