import { connection, NextResponse } from "next/server";
import { requireAdminWalletSwapApi } from "@/lib/wallet/require-admin-wallet-swap-api";
import { fetchAdminSwapCallStatus } from "@/lib/wallet/swap-submit-service";
import { WALLET_SWAP_FIXED_ERROR } from "@/lib/wallet/swap-errors";

type StatusBody = {
  callId?: unknown;
};

export async function POST(request: Request) {
  await connection();
  const gate = await requireAdminWalletSwapApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  let body: StatusBody;
  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const callId = typeof body.callId === "string" ? body.callId.trim() : "";
  if (!callId) {
    return NextResponse.json({ error: "callId is required." }, { status: 400 });
  }

  try {
    const status = await fetchAdminSwapCallStatus(callId);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: WALLET_SWAP_FIXED_ERROR }, { status: 502 });
  }
}
