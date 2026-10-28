import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setAuthorProfilesEnabledForTests } from "./feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/payments/privy-linked-wallet", () => ({
  resolvePrivyLinkedChecksumWalletAddresses: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { getDb } from "@/db/client";
import { requireAuthorProfileEditAccess } from "./author-access";

describe("requireAuthorProfileEditAccess", () => {
  const selectMock = vi.fn();

  beforeEach(() => {
    setAuthorProfilesEnabledForTests(true);
    vi.mocked(getDb).mockReturnValue({
      select: selectMock,
    } as never);
    selectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              payoutAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
            },
          ]),
        }),
      }),
    });
  });

  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    vi.mocked(requirePrivyAuth).mockReset();
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockReset();
    selectMock.mockReset();
  });

  it("returns 404 when author profiles are disabled", async () => {
    setAuthorProfilesEnabledForTests(false);
    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost"),
      "g2",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
    expect(requirePrivyAuth).not.toHaveBeenCalled();
  });

  it("allows Privy admins to edit any author", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValueOnce({
      ok: true,
      user: { userId: "did:privy:admin" },
    });

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
      "g2",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isAdmin).toBe(true);
    }
    expect(requirePrivyAuth).toHaveBeenCalledTimes(1);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("allows a writer when a linked wallet matches payout_address", async () => {
    vi.mocked(requirePrivyAuth)
      .mockResolvedValueOnce({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        user: { userId: "did:privy:writer" },
      });
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockResolvedValue([
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    ]);

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
      "g2",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isAdmin).toBe(false);
    }
  });

  it("returns 403 for non-admin when linked wallet does not match", async () => {
    vi.mocked(requirePrivyAuth)
      .mockResolvedValueOnce({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        user: { userId: "did:privy:writer" },
      });
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockResolvedValue([
      "0x0000000000000000000000000000000000000001",
    ]);

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
      "g2",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});
