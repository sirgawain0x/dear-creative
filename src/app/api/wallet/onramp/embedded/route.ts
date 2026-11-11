import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { buildCdpFacilitatorJwt } from "@/lib/payments/x402-agent";
import { coinbaseCheckoutUrl } from "@/lib/wallet/coinbase-onramp";
import { requireReaderWalletApi } from "@/lib/wallet/require-reader-wallet-api";

const ORDER_ENDPOINT = "https://api.cdp.coinbase.com/platform/v2/onramp/orders";

export async function POST(request: Request) {
  const gate = await requireReaderWalletApi(request);
  if (!gate.ok) return gate.response;

  const headers = { "Cache-Control": "private, no-store" };
  const unavailable = (status: number) =>
    NextResponse.json({ error: "onramp_unavailable" }, { status, headers });

  const origin = URL.parse(process.env.COINBASE_EMBEDDED_ONRAMP_ORIGIN?.trim() ?? "");
  const apiKeyId = process.env.CDP_API_KEY_ID?.trim();
  const apiKeySecret = process.env.CDP_API_KEY_SECRET?.trim().replace(/\\n/g, "\n");
  if (origin?.protocol !== "https:" || !apiKeyId || !apiKeySecret) {
    return unavailable(503);
  }
  if (request.headers.get("origin") !== origin.origin) return unavailable(403);

  const body = await request.json().catch(() => null);
  const amount = body?.amount;
  if (typeof amount !== "string" || !/^\d{1,4}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400, headers });
  }

  const forwardedIp = request.headers.get("x-vercel-forwarded-for")?.trim();
  const clientIp = process.env.VERCEL === "1" && forwardedIp && isIP(forwardedIp)
    ? forwardedIp
    : undefined;
  if (process.env.VERCEL === "1" && !clientIp) return unavailable(503);
  try {
    const jwt = buildCdpFacilitatorJwt({
      method: "POST",
      endpointUrl: ORDER_ENDPOINT,
      apiKeyId,
      apiKeySecret,
    });
    const response = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        destinationAddress: gate.ctx.address,
        destinationNetwork: "base",
        domain: origin.hostname,
        partnerUserRef: createHash("sha256").update(gate.ctx.privyUserId).digest("hex"),
        paymentAmount: Number(amount).toFixed(2),
        paymentCurrency: "USD",
        paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
        purchaseCurrency: "USDC",
        clientIp,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[reader-wallet] coinbase_embedded_order_rejected", { status: response.status });
      return unavailable(502);
    }
    const { paymentLink } = await response.json();
    const checkout = coinbaseCheckoutUrl(paymentLink?.url);
    if (!checkout) return unavailable(502);

    return NextResponse.json({ checkoutUrl: checkout.href }, { headers });
  } catch {
    console.error("[reader-wallet] coinbase_embedded_order_failed");
    return unavailable(502);
  }
}
