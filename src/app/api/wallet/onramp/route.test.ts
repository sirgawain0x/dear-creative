import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/wallet/require-reader-wallet-api", () => ({
  requireReaderWalletApi: async () => ({
    ok: true,
    ctx: { address: "0x0000000000000000000000000000000000000001" },
  }),
}));

vi.mock("@/lib/payments/x402-agent", () => ({
  buildCdpFacilitatorJwt: () => "test-jwt",
}));

const coinbaseFetch = vi.fn();

beforeEach(() => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("CDP_API_KEY_ID", "test-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "test-secret");
  coinbaseFetch.mockReset();
  vi.stubGlobal("fetch", coinbaseFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Coinbase wallet on-ramp", () => {
  it("sends Vercel's client IP with the authenticated Base USDC destination", async () => {
    coinbaseFetch.mockResolvedValueOnce(Response.json({ token: "test-token" }));
    const response = await POST(new Request("https://example.com/api/wallet/onramp", {
      method: "POST",
      headers: {
        "x-vercel-forwarded-for": "2001:db8::1",
        "x-forwarded-for": "192.0.2.1",
      },
    }));

    expect(response.status).toBe(200);
    expect(JSON.parse(coinbaseFetch.mock.calls[0][1].body)).toEqual({
      addresses: [{ address: "0x0000000000000000000000000000000000000001", blockchains: ["base"] }],
      assets: ["USDC"],
      clientIp: "2001:db8::1",
    });
  });

  it.each([undefined, "192.0.2.1, 192.0.2.2"])(
    "rejects a missing or malformed Vercel client IP (%s)",
    async (ip) => {
      const response = await POST(new Request("https://example.com/api/wallet/onramp", {
        method: "POST",
        headers: ip ? { "x-vercel-forwarded-for": ip } : {},
      }));

      expect(response.status).toBe(503);
      expect(coinbaseFetch).not.toHaveBeenCalled();
    },
  );
});
