import { connection, NextResponse } from "next/server";
import { requireAdminWalletSwapApi } from "@/lib/wallet/require-admin-wallet-swap-api";
import { requestAdminSwapQuote } from "@/lib/wallet/swap-quote-service";
import { WALLET_SWAP_FIXED_ERROR } from "@/lib/wallet/swap-errors";
import type { SwapDirection } from "@/lib/wallet/swap-constants";

type QuoteBody = {
  direction?: unknown;
  amount?: unknown;
  slippageBps?: unknown;
};

function parseDirection(raw: unknown): SwapDirection | null {
  if (raw === "USDC_TO_ETH" || raw === "ETH_TO_USDC") {
    return raw;
  }
  return null;
}

export async function POST(request: Request) {
  await connection();
  const gate = await requireAdminWalletSwapApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const direction = parseDirection(body.direction);
  if (!direction) {
    return NextResponse.json(
      { error: "direction must be USDC_TO_ETH or ETH_TO_USDC." },
      { status: 400 },
    );
  }

  const amount = typeof body.amount === "string" ? body.amount : "";
  const slippageBps =
    typeof body.slippageBps === "number" ? body.slippageBps : undefined;

  try {
    const result = await requestAdminSwapQuote({ direction, amount, slippageBps });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.field ? { field: result.field } : {}) },
        { status: result.status },
      );
    }

    const { prepared, ...summary } = result.quote;
    return NextResponse.json({
      ...summary,
      prepared,
    });
  } catch {
    return NextResponse.json({ error: WALLET_SWAP_FIXED_ERROR }, { status: 502 });
  }
}
