import { describe, expect, it } from "vitest";
import {
  PRIVY_WALLET_API_BASE,
  privyEarnDepositUrl,
  privyEarnWithdrawUrl,
  privyWalletActionUrl,
} from "./privy-earn-urls";

describe("privy-earn-urls", () => {
  it("uses Privy API reference base path (/v1, not /api/v1)", () => {
    expect(PRIVY_WALLET_API_BASE).toBe("https://api.privy.io/v1");
    expect(PRIVY_WALLET_API_BASE).not.toBe("https://api.privy.io/api/v1");
  });

  it("builds deposit, withdraw, and action status URLs from the shared base", () => {
    const walletId = "wallet-abc";
    const actionId = "action-xyz";

    expect(privyEarnDepositUrl(walletId)).toBe(
      "https://api.privy.io/v1/wallets/wallet-abc/earn/ethereum/deposit",
    );
    expect(privyEarnWithdrawUrl(walletId)).toBe(
      "https://api.privy.io/v1/wallets/wallet-abc/earn/ethereum/withdraw",
    );
    expect(privyWalletActionUrl(walletId, actionId)).toBe(
      "https://api.privy.io/v1/wallets/wallet-abc/actions/action-xyz",
    );
  });
});
