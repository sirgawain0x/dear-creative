import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPrivyEarnVaultDetails,
  fetchPrivyEarnVaultPosition,
} from "./privy-earn";

describe("privy-earn client", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "app-id-test");
    vi.stubEnv("PRIVY_APP_SECRET", "super-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls Privy REST with Basic auth and privy-app-id header", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: "vault-1",
        name: "Test",
        provider: "aave",
        vault_address: "0x1",
        asset: { address: "0x2", symbol: "usdc", decimals: 6 },
        caip2: "eip155:8453",
        user_apy: 420,
        app_apy: 80,
        tvl_usd: 1,
        available_liquidity_usd: 1,
        admin_wallet_id: "w",
        admin_wallet_address: "0x3",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchPrivyEarnVaultDetails("vault-1");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["privy-app-id"]).toBe("app-id-test");
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("super-secret-value");
  });

  it("never logs the app secret or Authorization header", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    await expect(fetchPrivyEarnVaultPosition("wallet-1", "vault-1")).rejects.toThrow();

    for (const call of logSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain("super-secret-value");
      expect(serialized).not.toMatch(/Basic [A-Za-z0-9+/=]+/);
    }
    logSpy.mockRestore();
  });
});
