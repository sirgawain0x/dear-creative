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

vi.mock("@/lib/wallet/reader-embedded-wallet", () => ({
  resolveReaderEmbeddedWalletFromAuthorization: vi.fn(),
}));

vi.mock("@/lib/wallet/reader-wallet-history", () => ({
  fetchReaderUsdcTransferHistory: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { resolveReaderEmbeddedWalletFromAuthorization } from "@/lib/wallet/reader-embedded-wallet";
import { fetchReaderUsdcTransferHistory } from "@/lib/wallet/reader-wallet-history";
import { setReaderWalletEnabledForTests } from "@/lib/wallet/reader-wallet-feature-flag";
import { getAddress } from "viem";
import { GET } from "./route";

const USER_A = "did:privy:user-a";
const USER_B = "did:privy:user-b";
const ADDR_A = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");
const ADDR_B = getAddress("0x1111111111111111111111111111111111111111");

describe("GET /api/wallet/history", () => {
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
    vi.mocked(fetchReaderUsdcTransferHistory).mockResolvedValue({
      transfers: [
        {
          id: "tx-a",
          direction: "in",
          category: "erc20",
          asset: "USDC",
          value: "1.00",
          valueRaw: "1000000",
          hash: "0xabc",
          from: ADDR_B,
          to: ADDR_A,
          blockNum: "0x1",
          timestamp: null,
        },
      ],
      pagination: { incomingPageKey: null, outgoingPageKey: null },
    });
  });

  afterEach(() => {
    setReaderWalletEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when reader wallet feature is disabled", async () => {
    setReaderWalletEnabledForTests(false);
    const res = await GET(new Request("http://localhost/api/wallet/history"));
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(new Request("http://localhost/api/wallet/history"));
    expect(res.status).toBe(401);
  });

  it("returns user A history only — ignores client address query params", async () => {
    vi.mocked(fetchReaderUsdcTransferHistory).mockImplementation(
      async ({ wallet }) => ({
        transfers: [
          {
            id: "tx-for-wallet",
            direction: "in",
            category: "erc20",
            asset: "USDC",
            value: wallet === ADDR_A ? "5.00" : "999",
            valueRaw: null,
            hash: "0xdef",
            from: ADDR_B,
            to: wallet,
            blockNum: "0x2",
            timestamp: null,
          },
        ],
        pagination: { incomingPageKey: null, outgoingPageKey: null },
      }),
    );

    const res = await GET(
      new Request(
        `http://localhost/api/wallet/history?address=${ADDR_B}&userId=${USER_B}`,
        { headers: { Authorization: "Bearer token-a" } },
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.address).toBe(ADDR_A);
    expect(json.chainId).toBe(8453);
    expect(fetchReaderUsdcTransferHistory).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: ADDR_A }),
    );
    expect(json.transfers[0]?.value).toBe("5.00");
  });
});
