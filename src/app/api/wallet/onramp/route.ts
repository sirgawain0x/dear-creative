import { NextResponse } from "next/server";
import { buildCdpFacilitatorJwt } from "@/lib/payments/x402-agent";
import { requireReaderWalletApi } from "@/lib/wallet/require-reader-wallet-api";

const SESSION_ENDPOINT = "https://api.developer.coinbase.com/onramp/v1/token";

export async function POST(request: Request) {
  const gate = await requireReaderWalletApi(request);
  if (!gate.ok) return gate.response;

  const headers = { "Cache-Control": "private, no-store" };
  const apiKeyId = process.env.CDP_API_KEY_ID?.trim();
  const apiKeySecret = process.env.CDP_API_KEY_SECRET?.trim().replace(/\\n/g, "\n");
  if (!apiKeyId || !apiKeySecret) {
    return NextResponse.json({ error: "onramp_unavailable" }, { status: 503, headers });
  }

  try {
    const jwt = buildCdpFacilitatorJwt({
      method: "POST",
      endpointUrl: SESSION_ENDPOINT,
      apiKeyId,
      apiKeySecret,
    });
    const response = await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [{ address: gate.ctx.address, blockchains: ["base"] }],
        assets: ["USDC"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[reader-wallet] coinbase_onramp_rejected", { status: response.status });
      return NextResponse.json({ error: "onramp_unavailable" }, { status: 502, headers });
    }
    const { token } = (await response.json()) as { token?: unknown };
    if (typeof token !== "string" || !token) throw new Error("Missing session token");

    const checkout = new URL("https://pay.coinbase.com/buy/select-asset");
    checkout.searchParams.set("sessionToken", token);
    checkout.searchParams.set("defaultNetwork", "base");
    checkout.searchParams.set("defaultAsset", "USDC");
    return NextResponse.json({ checkoutUrl: checkout.toString() }, { headers });
  } catch {
    console.error("[reader-wallet] coinbase_onramp_session_failed");
    return NextResponse.json({ error: "onramp_unavailable" }, { status: 502, headers });
  }
}
