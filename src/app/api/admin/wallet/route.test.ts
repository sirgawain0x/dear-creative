import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";
import { GET as GET_HISTORY } from "./history/route";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: vi.fn().mockResolvedValue({
    eth: { raw: "1", formatted: "0.001" },
    usdc: { raw: "2", formatted: "0.000002" },
  }),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { setWalletEnabledForTests } from "@/lib/wallet/feature-flag";
import * as historyRoute from "./history/route";
import * as walletRoute from "./route";

describe("GET /api/admin/wallet", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    vi.stubEnv(
      "ADMIN_WALLET_ADDRESS",
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    );
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 when wallet feature is disabled", async () => {
    setWalletEnabledForTests(false);
    const res = await GET(new Request("http://localhost/api/admin/wallet"));
    expect(res.status).toBe(404);
  });

  it("requires privy admin auth", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(403);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("rejects adam/studio service token (privy admin only)", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer adam-token" },
      }),
    );
    expect(res.status).toBe(401);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("returns not configured when ADMIN_WALLET_ADDRESS is unset", async () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", "");
    const res = await GET(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.configured).toBe(false);
    expect(json.reason).toBe("unset");
  });

  it("returns balances for configured address", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.configured).toBe(true);
    expect(json.balances.eth.formatted).toBe("0.001");
  });
});

describe("GET /api/admin/wallet/history adam bearer", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    vi.stubEnv(
      "ADMIN_WALLET_ADDRESS",
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    );
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects adam/studio bearer with 401", async () => {
    const res = await GET_HISTORY(
      new Request("http://localhost/api/admin/wallet/history", {
        headers: { Authorization: "Bearer studio-adam-key" },
      }),
    );
    expect(res.status).toBe(401);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });
});

describe("admin wallet routes HTTP methods", () => {
  it("only exposes GET handlers (no write methods)", () => {
    expect(typeof GET).toBe("function");
    expect(typeof GET_HISTORY).toBe("function");
    for (const routeModule of [walletRoute, historyRoute]) {
      expect((routeModule as { POST?: unknown }).POST).toBeUndefined();
      expect((routeModule as { PUT?: unknown }).PUT).toBeUndefined();
      expect((routeModule as { PATCH?: unknown }).PATCH).toBeUndefined();
      expect((routeModule as { DELETE?: unknown }).DELETE).toBeUndefined();
    }
  });
});
