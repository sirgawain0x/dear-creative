import { getAddress } from "viem";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import {
  earnActionsIdempotencyKey,
  getIdempotentEarnActionResponse,
  storeIdempotentEarnActionResponse,
} from "./idempotency-cache";
import {
  fetchPrivyEarnVaultDetails,
  fetchPrivyEarnVaultPosition,
} from "./privy-earn";
import {
  postPrivyEarnDeposit,
  postPrivyEarnWithdraw,
} from "./privy-earn-actions";
import { parseRawAmountString, validateEarnActionRequest } from "./validate-action";
import { assertEarnWalletAccess } from "./wallet-access";
import type { EarnActionDirection } from "./validate-action";

export type SubmitEarnActionInput = {
  userId: string;
  walletId: string;
  walletAddress: string;
  vaultId: string;
  rawAmount: string;
  direction: EarnActionDirection;
  authorizationSignature: string;
  idempotencyKey: string;
};

export type SubmitEarnActionResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; body: unknown };

export async function submitEarnAction(
  input: SubmitEarnActionInput,
): Promise<SubmitEarnActionResult> {
  if (!input.authorizationSignature) {
    return {
      ok: false,
      status: 400,
      body: { error: "missing_authorization_signature" },
    };
  }
  if (!input.idempotencyKey) {
    return {
      ok: false,
      status: 400,
      body: { error: "missing_idempotency_key" },
    };
  }

  const idempotencyCacheKey = earnActionsIdempotencyKey(
    input.userId,
    input.idempotencyKey,
  );
  const cached = getIdempotentEarnActionResponse(idempotencyCacheKey);
  if (cached) {
    return { ok: true, status: cached.status, body: cached.body };
  }

  const access = await assertEarnWalletAccess({
    userId: input.userId,
    walletId: input.walletId,
    walletAddress: input.walletAddress,
  });
  if (!access.ok) {
    const status = access.code === "wallet_not_owned" ? 403 : 400;
    return { ok: false, status, body: { error: access.code } };
  }

  const rawAmount = parseRawAmountString(input.rawAmount);
  if (rawAmount === null) {
    return { ok: false, status: 400, body: { error: "invalid_amount" } };
  }

  let walletUsdcBalanceRaw = BigInt(0);
  let assetsInVaultRaw = BigInt(0);
  let availableLiquidityUsd: number | null = null;

  try {
    const balances = await fetchWalletBalances(getAddress(input.walletAddress));
    walletUsdcBalanceRaw = BigInt(balances.usdc.raw);
  } catch {
    return {
      ok: false,
      status: 502,
      body: { error: "balance_unavailable" },
    };
  }

  try {
    const [vault, position] = await Promise.all([
      fetchPrivyEarnVaultDetails(input.vaultId),
      fetchPrivyEarnVaultPosition(input.walletId, input.vaultId),
    ]);
    availableLiquidityUsd = vault.available_liquidity_usd;
    assetsInVaultRaw = BigInt(position.assets_in_vault);
  } catch {
    return {
      ok: false,
      status: 502,
      body: { error: "vault_context_unavailable" },
    };
  }

  const validation = validateEarnActionRequest({
    vaultId: input.vaultId,
    rawAmount,
    direction: input.direction,
    walletUsdcBalanceRaw,
    assetsInVaultRaw,
    availableLiquidityUsd,
  });
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      body: { error: validation.code },
    };
  }

  const privyBody = {
    vault_id: input.vaultId,
    raw_amount: rawAmount.toString(),
  };

  try {
    const action =
      input.direction === "deposit"
        ? await postPrivyEarnDeposit({
            walletId: input.walletId,
            body: privyBody,
            authorizationSignature: input.authorizationSignature,
            idempotencyKey: input.idempotencyKey,
          })
        : await postPrivyEarnWithdraw({
            walletId: input.walletId,
            body: privyBody,
            authorizationSignature: input.authorizationSignature,
            idempotencyKey: input.idempotencyKey,
          });

    const responseBody = { action };
    storeIdempotentEarnActionResponse(
      idempotencyCacheKey,
      responseBody,
      200,
    );
    return { ok: true, status: 200, body: responseBody };
  } catch {
    return {
      ok: false,
      status: 502,
      body: { error: "earn_action_submit_failed" },
    };
  }
}
