import { connection, NextResponse } from "next/server";
import { resolveAdminWalletConfig } from "@/lib/wallet/admin-wallet-address";
import { requireAdminWalletSwapApi } from "@/lib/wallet/require-admin-wallet-swap-api";
import { submitAdminSwapPreparedCall, assertPreparedFromAdmin } from "@/lib/wallet/swap-submit-service";
import { WALLET_SWAP_FIXED_ERROR } from "@/lib/wallet/swap-errors";

type SubmitBody = {
  prepared?: unknown;
  signature?: unknown;
  chainId?: unknown;
};

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

  if (!body.prepared || typeof body.prepared !== "object") {
    return NextResponse.json({ error: "prepared is required." }, { status: 400 });
  }

  const signature =
    typeof body.signature === "string" && body.signature.startsWith("0x")
      ? (body.signature as `0x${string}`)
      : null;
  if (!signature) {
    return NextResponse.json({ error: "signature is required." }, { status: 400 });
  }

  const prepared = body.prepared as Record<string, unknown>;
  if (!assertPreparedFromAdmin(prepared, config.address)) {
    return NextResponse.json({ error: "Swap from address mismatch." }, { status: 400 });
  }

  const chainId =
    typeof body.chainId === "number" && body.chainId === 8453 ? body.chainId : 8453;

  try {
    const result = await submitAdminSwapPreparedCall({
      prepared,
      signature,
      chainId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ callId: result.callId });
  } catch {
    return NextResponse.json({ error: WALLET_SWAP_FIXED_ERROR }, { status: 502 });
  }
}
