import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEarnActionsIdempotencyCacheForTests } from "./idempotency-cache";
import { EARN_VAULT_AAVE_ID } from "./vaults";

vi.mock("./wallet-access", () => ({
  assertEarnWalletAccess: vi.fn(),
}));

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: vi.fn(),
}));

vi.mock("./privy-earn", () => ({
  fetchPrivyEarnVaultDetails: vi.fn(),
  fetchPrivyEarnVaultPosition: vi.fn(),
}));

vi.mock("./privy-earn-actions", () => ({
  postPrivyEarnDeposit: vi.fn(),
  postPrivyEarnWithdraw: vi.fn(),
}));

import { assertEarnWalletAccess } from "./wallet-access";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import {
  fetchPrivyEarnVaultDetails,
  fetchPrivyEarnVaultPosition,
} from "./privy-earn";
import { postPrivyEarnDeposit } from "./privy-earn-actions";
import { submitEarnAction } from "./submit-earn-action";

describe("submitEarnAction", () => {
  beforeEach(() => {
    clearEarnActionsIdempotencyCacheForTests();
    vi.mocked(assertEarnWalletAccess).mockResolvedValue({ ok: true });
    vi.mocked(fetchWalletBalances).mockResolvedValue({
      eth: { raw: "0", formatted: "0" },
      usdc: { raw: "5000000", formatted: "5" },
    });
    vi.mocked(fetchPrivyEarnVaultDetails).mockResolvedValue({
      id: EARN_VAULT_AAVE_ID,
      name: "Aave",
      provider: "aave",
      vault_address: "0x1",
      asset: { address: "0x2", symbol: "usdc", decimals: 6 },
      caip2: "eip155:8453",
      user_apy: 1,
      app_apy: 1,
      tvl_usd: 1,
      available_liquidity_usd: 1000,
      admin_wallet_id: "a",
      admin_wallet_address: "0x3",
    });
    vi.mocked(fetchPrivyEarnVaultPosition).mockResolvedValue({
      asset: { address: "0x2", symbol: "usdc", decimals: 6 },
      total_deposited: "0",
      total_withdrawn: "0",
      assets_in_vault: "1000000",
      shares_in_vault: "1",
    });
    vi.mocked(postPrivyEarnDeposit).mockResolvedValue({
      id: "action-1",
      wallet_id: "wallet-1",
      type: "earn_deposit",
      status: "pending",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearEarnActionsIdempotencyCacheForTests();
  });

  it("returns 403 when wallet is not owned", async () => {
    vi.mocked(assertEarnWalletAccess).mockResolvedValue({
      ok: false,
      code: "wallet_not_owned",
    });
    const result = await submitEarnAction({
      userId: "did:privy:user",
      walletId: "wallet-1",
      walletAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
      vaultId: EARN_VAULT_AAVE_ID,
      rawAmount: "1000000",
      direction: "deposit",
      authorizationSignature: "sig",
      idempotencyKey: "key-1",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("reuses idempotent responses", async () => {
    const input = {
      userId: "did:privy:user",
      walletId: "wallet-1",
      walletAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
      vaultId: EARN_VAULT_AAVE_ID,
      rawAmount: "1000000",
      direction: "deposit" as const,
      authorizationSignature: "sig",
      idempotencyKey: "key-dup",
    };
    const first = await submitEarnAction(input);
    const second = await submitEarnAction(input);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(postPrivyEarnDeposit).toHaveBeenCalledTimes(1);
  });
});
