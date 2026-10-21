import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: vi.fn(),
}));

vi.mock("@/lib/wallet/reader-embedded-wallet", () => ({
  resolveReaderEmbeddedWalletFromAuthorization: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import { resolveReaderEmbeddedWalletFromAuthorization } from "@/lib/wallet/reader-embedded-wallet";
import { setReaderWalletEnabledForTests } from "@/lib/wallet/reader-wallet-feature-flag";
import { getAddress } from "viem";
import { GET } from "./route";

const USER_A = "did:privy:user-a";
const USER_B = "did:privy:user-b";
const ADDR_A = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const ADDR_B = getAddress("0x1111111111111111111111111111111111111111");

describe("GET /api/wallet/me", () => {
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
    vi.mocked(fetchWalletBalances).mockResolvedValue({
      eth: { raw: "1", formatted: "0.001" },
      usdc: { raw: "2", formatted: "0.000002" },
    });
  });

  afterEach(() => {
    setReaderWalletEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when reader wallet feature is disabled", async () => {
    setReaderWalletEnabledForTests(false);
    const res = await GET(new Request("http://localhost/api/wallet/me"));
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(new Request("http://localhost/api/wallet/me"));
    expect(res.status).toBe(401);
  });

  it("returns user A wallet only — ignores client address query params", async () => {
    vi.mocked(fetchWalletBalances).mockImplementation(async (address) => ({
      eth: { raw: "1", formatted: address === ADDR_A ? "0.001" : "9" },
      usdc: { raw: "2", formatted: "0.000002" },
    }));

    const res = await GET(
      new Request(
        `http://localhost/api/wallet/me?address=${ADDR_B}&userId=${USER_B}`,
        { headers: { Authorization: "Bearer token-a" } },
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.address).toBe(ADDR_A);
    expect(fetchWalletBalances).toHaveBeenCalledWith(ADDR_A);
    expect(json.chainId).toBe(8453);
  });

  it("user B token resolves to user B address, not user A", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: USER_B },
    });
    vi.mocked(resolveReaderEmbeddedWalletFromAuthorization).mockResolvedValue({
      privyUserId: USER_B,
      address: ADDR_B,
    });

    const res = await GET(
      new Request("http://localhost/api/wallet/me", {
        headers: { Authorization: "Bearer token-b" },
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.address).toBe(ADDR_B);
    expect(fetchWalletBalances).toHaveBeenCalledWith(ADDR_B);
  });

  it("requires privy auth without admin gate", async () => {
    await GET(
      new Request("http://localhost/api/wallet/me", {
        headers: { Authorization: "Bearer x" },
      }),
    );
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request));
  });
});
