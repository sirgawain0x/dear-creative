import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import {
  pickPrivyEmbeddedConnectedWallet,
  resolveAdminEarnActionWallet,
  type EarnActionPrivyUser,
} from "./admin-earn-embedded-wallet";

const EMBEDDED_ADDR = getAddress(
  "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
);

describe("admin earn embedded wallet", () => {
  it("picks privy embedded connected wallet", () => {
    const picked = pickPrivyEmbeddedConnectedWallet([
      {
        address: "0x1111111111111111111111111111111111111111",
        walletClientType: "metamask",
        connectorType: "injected",
      },
      {
        address: EMBEDDED_ADDR,
        walletClientType: "privy",
        connectorType: "embedded",
        imported: false,
      },
    ]);
    expect(picked?.address).toBe(EMBEDDED_ADDR);
  });

  it("resolves wallet id from user.wallet when addresses match", () => {
    const user: EarnActionPrivyUser = {
      wallet: { id: "privy-wallet-id", address: EMBEDDED_ADDR },
      linkedAccounts: [],
    };
    const resolved = resolveAdminEarnActionWallet({
      user,
      wallets: [
        {
          address: EMBEDDED_ADDR,
          walletClientType: "privy",
          connectorType: "embedded",
        },
      ],
    });
    expect(resolved).toEqual({
      walletId: "privy-wallet-id",
      walletAddress: EMBEDDED_ADDR,
    });
  });

  it("falls back to linked privy wallet id", () => {
    const user: EarnActionPrivyUser = {
      wallet: undefined,
      linkedAccounts: [
        {
          type: "wallet",
          id: "linked-wallet-id",
          address: EMBEDDED_ADDR,
          walletClientType: "privy",
        },
      ],
    };
    const resolved = resolveAdminEarnActionWallet({
      user,
      wallets: [
        {
          address: EMBEDDED_ADDR,
          walletClientType: "privy",
          connectorType: "embedded",
        },
      ],
    });
    expect(resolved?.walletId).toBe("linked-wallet-id");
  });
});
