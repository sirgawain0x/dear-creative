import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@privy-io/server-auth";
import { getAddress } from "viem";

vi.mock("@/lib/privy/server-client", () => ({
  getPrivyServerClient: vi.fn(),
}));

import { getPrivyServerClient } from "@/lib/privy/server-client";
import { assertEarnWalletAccess } from "./wallet-access";

const WALLET_ID = "privy-embedded-wallet-id";
const WALLET_ADDRESS = getAddress(
  "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
);

describe("assertEarnWalletAccess", () => {
  beforeEach(() => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", "did:privy:admin-only");
    vi.mocked(getPrivyServerClient).mockReturnValue({
      walletApi: {
        getWallet: vi.fn().mockResolvedValue({
          id: WALLET_ID,
          address: WALLET_ADDRESS,
        }),
      },
      getUser: vi.fn().mockResolvedValue({
        linkedAccounts: [],
        wallet: undefined,
      } as unknown as User),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("requires linked wallet even for configured admin users", async () => {
    const result = await assertEarnWalletAccess({
      userId: "did:privy:admin-only",
      walletId: WALLET_ID,
      walletAddress: WALLET_ADDRESS,
    });
    expect(result).toEqual({ ok: false, code: "wallet_not_owned" });
  });

  it("allows access when wallet is linked to the user", async () => {
    vi.mocked(getPrivyServerClient).mockReturnValue({
      walletApi: {
        getWallet: vi.fn().mockResolvedValue({
          id: WALLET_ID,
          address: WALLET_ADDRESS,
        }),
      },
      getUser: vi.fn().mockResolvedValue({
        linkedAccounts: [
          {
            type: "wallet",
            id: WALLET_ID,
            address: WALLET_ADDRESS,
          },
        ],
        wallet: { id: WALLET_ID, address: WALLET_ADDRESS },
      } as unknown as User),
    } as never);

    const result = await assertEarnWalletAccess({
      userId: "did:privy:admin-only",
      walletId: WALLET_ID,
      walletAddress: WALLET_ADDRESS,
    });
    expect(result).toEqual({ ok: true });
  });
});
