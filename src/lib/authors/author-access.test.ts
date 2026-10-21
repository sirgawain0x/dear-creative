import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setAuthorProfilesEnabledForTests } from "./feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/payments/privy-linked-wallet", () => ({
  resolvePrivyLinkedChecksumWalletAddresses: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { requireAuthorProfileEditAccess } from "./author-access";

describe("requireAuthorProfileEditAccess", () => {
  beforeEach(() => {
    setAuthorProfilesEnabledForTests(true);
  });

  afterEach(() => {
    setAuthorProfilesEnabledForTests(undefined);
    vi.mocked(requirePrivyAuth).mockReset();
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockReset();
  });

  it("returns 404 when author profiles are disabled", async () => {
    setAuthorProfilesEnabledForTests(false);
    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
    expect(requirePrivyAuth).not.toHaveBeenCalled();
  });

  it("requires Privy admin auth", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });

    await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("returns 403 for non-admin even when linked wallet matches author payout_address", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    vi.mocked(resolvePrivyLinkedChecksumWalletAddresses).mockResolvedValue([
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    ]);

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
    expect(resolvePrivyLinkedChecksumWalletAddresses).not.toHaveBeenCalled();
  });

  it("allows Privy admins to edit", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });

    const result = await requireAuthorProfileEditAccess(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.privyUserId).toBe("did:privy:admin");
      expect(result.isAdmin).toBe(true);
    }
  });
});
