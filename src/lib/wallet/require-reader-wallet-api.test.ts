import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getAddress } from "viem";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/wallet/reader-embedded-wallet", () => ({
  resolveReaderEmbeddedWalletFromAuthorization: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { resolveReaderEmbeddedWalletFromAuthorization } from "./reader-embedded-wallet";
import { setReaderWalletEnabledForTests } from "./reader-wallet-feature-flag";
import { requireReaderWalletApi } from "./require-reader-wallet-api";

const USER_A = "did:privy:user-a";
const USER_B = "did:privy:user-b";
const ADDR_A = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

describe("requireReaderWalletApi", () => {
  beforeEach(() => {
    setReaderWalletEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: USER_A },
    });
    vi.mocked(resolveReaderEmbeddedWalletFromAuthorization).mockResolvedValue({
      privyUserId: USER_A,
      address: ADDR_A,
    });
  });

  afterEach(() => {
    setReaderWalletEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 401 when session user id does not match resolved wallet user id", async () => {
    vi.mocked(resolveReaderEmbeddedWalletFromAuthorization).mockResolvedValue({
      privyUserId: USER_B,
      address: ADDR_A,
    });

    const result = await requireReaderWalletApi(
      new Request("http://localhost/api/wallet/me", {
        headers: { Authorization: "Bearer token-a" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const json = await result.response.json();
      expect(json).toEqual({ error: "Unauthorized" });
    }
  });
});
