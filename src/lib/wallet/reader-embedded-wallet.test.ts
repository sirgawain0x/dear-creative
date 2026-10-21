import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { resolvePrivyEmbeddedWalletAddress } from "./reader-embedded-wallet";

describe("resolvePrivyEmbeddedWalletAddress", () => {
  it("prefers user.wallet address when valid", () => {
    const addr = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
    const user = {
      wallet: { address: addr },
      linkedAccounts: [],
    } as Parameters<typeof resolvePrivyEmbeddedWalletAddress>[0];
    expect(resolvePrivyEmbeddedWalletAddress(user)).toBe(addr);
  });

  it("falls back to privy embedded linked account", () => {
    const addr = getAddress("0x1111111111111111111111111111111111111111");
    const user = {
      wallet: undefined,
      linkedAccounts: [
        {
          type: "wallet",
          address: addr,
          walletClientType: "privy",
        },
      ],
    } as Parameters<typeof resolvePrivyEmbeddedWalletAddress>[0];
    expect(resolvePrivyEmbeddedWalletAddress(user)).toBe(addr);
  });

  it("ignores external linked wallets", () => {
    const user = {
      wallet: undefined,
      linkedAccounts: [
        {
          type: "wallet",
          address: "0x2222222222222222222222222222222222222222",
          walletClientType: "metamask",
        },
      ],
    } as Parameters<typeof resolvePrivyEmbeddedWalletAddress>[0];
    expect(resolvePrivyEmbeddedWalletAddress(user)).toBeNull();
  });
});
