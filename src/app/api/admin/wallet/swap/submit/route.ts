import { connection, NextResponse } from "next/server";
import { resolveAdminWalletConfig } from "@/lib/wallet/admin-wallet-address";
import { requireAdminWalletSwapApi } from "@/lib/wallet/require-admin-wallet-swap-api";
import {
  submitAdminSwapPreparedCall,
  assertPreparedFromAdmin,
} from "@/lib/wallet/swap-submit-service";
import type { SwapDirection } from "@/lib/wallet/swap-constants";
import { WALLET_SWAP_FIXED_ERROR } from "@/lib/wallet/swap-errors";

type SubmitBody = {
  prepared?: unknown;
  signature?: unknown;
  authorizations?: unknown;
  chainId?: unknown;
  direction?: unknown;
  amount?: unknown;
  slippageBps?: unknown;
};

function isSwapDirection(value: unknown): value is SwapDirection {
  return value === "USDC_TO_ETH" || value === "ETH_TO_USDC";
}

export async function POST(request: Request) {
  await connection();
  const gate = await requireAdminWalletSwapApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Admin wallet is not configured." }, { status: 400 });
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    !body.prepared ||
    (typeof body.prepared !== "object" && !Array.isArray(body.prepared))
  ) {
    return NextResponse.json({ error: "prepared is required." }, { status: 400 });
  }

  const signature =
    typeof body.signature === "string" && body.signature.startsWith("0x")
      ? (body.signature as `0x${string}`)
      : null;
  if (!signature) {
    return NextResponse.json({ error: "signature is required." }, { status: 400 });
  }

  const prepared = body.prepared as Record<string, unknown> | unknown[];
  if (!assertPreparedFromAdmin(prepared, config.address)) {
    return NextResponse.json({ error: "Swap from address mismatch." }, { status: 400 });
  }

  if (!isSwapDirection(body.direction)) {
    return NextResponse.json({ error: "direction is required." }, { status: 400 });
  }
  if (typeof body.amount !== "string" || !body.amount.trim()) {
    return NextResponse.json({ error: "amount is required." }, { status: 400 });
  }
  if (typeof body.slippageBps !== "number" || !Number.isInteger(body.slippageBps)) {
    return NextResponse.json({ error: "slippageBps is required." }, { status: 400 });
  }

  const authorizations = Array.isArray(body.authorizations) ? body.authorizations : [];

  const chainId =
    typeof body.chainId === "number" && body.chainId === 8453 ? body.chainId : 8453;

  try {
    const result = await submitAdminSwapPreparedCall({
      prepared,
      signature,
      authorizations,
      chainId,
      quoteBinding: {
        direction: body.direction,
        amount: body.amount.trim(),
        slippageBps: body.slippageBps,
      },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ callId: result.callId });
  } catch {
    return NextResponse.json({ error: WALLET_SWAP_FIXED_ERROR }, { status: 502 });
  }
}
