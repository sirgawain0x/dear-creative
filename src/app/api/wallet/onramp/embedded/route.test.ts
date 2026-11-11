import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireReaderWalletApi } from "@/lib/wallet/require-reader-wallet-api";
import { POST } from "./route";

vi.mock("@/lib/wallet/require-reader-wallet-api", () => ({
  requireReaderWalletApi: vi.fn(),
}));

const ORIGIN = "https://dear.example";
const WALLET = "0x0000000000000000000000000000000000000001";

function request(origin = ORIGIN) {
  return new Request(`${ORIGIN}/api/wallet/onramp/embedded`, {
    method: "POST",
    headers: { Origin: origin },
    body: JSON.stringify({ amount: "25.5", destinationAddress: "client-supplied" }),
  });
}

describe("embedded Coinbase Onramp", () => {
  beforeEach(() => {
    vi.stubEnv("COINBASE_EMBEDDED_ONRAMP_ORIGIN", ORIGIN);
    vi.stubEnv("CDP_API_KEY_ID", "test-key");
    vi.stubEnv("CDP_API_KEY_SECRET", Buffer.alloc(32, 1).toString("base64"));
    vi.mocked(requireReaderWalletApi).mockResolvedValue({
      ok: true,
      ctx: { address: WALLET, privyUserId: "did:privy:test", chainId: 8453 },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates an order for the authenticated wallet on Base", async () => {
    const checkoutUrl = "https://pay.coinbase.com/v2/api-onramp/apple-pay";
    const fetchOrder = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ paymentLink: { url: checkoutUrl }, userAuthToken: "private" }),
    );
    vi.stubGlobal("fetch", fetchOrder);

    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ checkoutUrl });
    expect(JSON.parse(String(fetchOrder.mock.calls[0]?.[1]?.body))).toMatchObject({
      destinationAddress: WALLET,
      destinationNetwork: "base",
      domain: "dear.example",
      paymentAmount: "25.50",
      paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
      purchaseCurrency: "USDC",
    });
  });

  it("rejects other origins before creating a Coinbase order", async () => {
    const fetchOrder = vi.fn();
    vi.stubGlobal("fetch", fetchOrder);
    expect((await POST(request("https://unapproved.example"))).status).toBe(403);
    expect(fetchOrder).not.toHaveBeenCalled();
  });
});
