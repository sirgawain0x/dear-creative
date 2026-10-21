import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EARN_VAULT_AAVE_ID } from "./vaults";
import { PRIVY_WALLET_API_BASE } from "./privy-earn-urls";
import {
  fetchPrivyEarnVaultDetails,
  fetchPrivyEarnVaultPosition,
  PrivyEarnRequestError,
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
    const firstCall = fetchMock.mock.calls[0] as unknown as
      | [string, RequestInit]
      | undefined;
    const headers = firstCall?.[1]?.headers as Record<string, string>;
    expect(headers["privy-app-id"]).toBe("app-id-test");
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("super-secret-value");
    expect(firstCall?.[0]).toBe(
      `${PRIVY_WALLET_API_BASE}/earn/ethereum/vaults/vault-1`,
    );
  });

  it("uses Privy docs earn base path (/api/v1, not /v1)", () => {
    expect(PRIVY_WALLET_API_BASE).toBe("https://api.privy.io/api/v1");
    expect(PRIVY_WALLET_API_BASE).not.toBe("https://api.privy.io/v1");
  });

  it("maps upstream vault 404 to earn_vault_not_found (502) and logs vault id", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );

    await expect(
      fetchPrivyEarnVaultDetails(EARN_VAULT_AAVE_ID),
    ).rejects.toMatchObject({
      code: "earn_vault_not_found",
      status: 502,
    } satisfies Partial<PrivyEarnRequestError>);

    expect(logSpy).toHaveBeenCalledWith(
      "[privy-earn] vault_not_found",
      expect.objectContaining({
        vaultId: EARN_VAULT_AAVE_ID,
        code: "earn_vault_not_found",
      }),
    );
    logSpy.mockRestore();
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
