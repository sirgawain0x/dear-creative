import type { User } from "@privy-io/server-auth";
import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { resolvePrivyEmbeddedWalletAddress } from "./reader-embedded-wallet";

function asPrivyUser(value: unknown): User {
  return value as User;
}

describe("resolvePrivyEmbeddedWalletAddress", () => {
  it("prefers user.wallet address when valid", () => {
    const addr = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
    const user = asPrivyUser({
      wallet: { address: addr },
      linkedAccounts: [],
    });
    expect(resolvePrivyEmbeddedWalletAddress(user)).toBe(addr);
  });

  it("falls back to privy embedded linked account", () => {
    const addr = getAddress("0x1111111111111111111111111111111111111111");
    const user = asPrivyUser({
      wallet: undefined,
      linkedAccounts: [
        {
          type: "wallet",
          address: addr,
          walletClientType: "privy",
        },
      ],
    });
    expect(resolvePrivyEmbeddedWalletAddress(user)).toBe(addr);
  });

  it("ignores external linked wallets", () => {
    const user = asPrivyUser({
      wallet: undefined,
      linkedAccounts: [
        {
          type: "wallet",
          address: "0x2222222222222222222222222222222222222222",
          walletClientType: "metamask",
        },
      ],
    });
    expect(resolvePrivyEmbeddedWalletAddress(user)).toBeNull();
  });
});
