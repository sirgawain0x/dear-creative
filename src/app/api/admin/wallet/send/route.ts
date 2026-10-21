import { connection, NextResponse } from "next/server";
import { resolveAdminWalletSendValidation } from "@/lib/wallet/admin-wallet-send-request";
import { executeAdminWalletSend } from "@/lib/wallet/execute-admin-wallet-send";
import {
  checkSendIdempotencyKey,
  clearSendIdempotencyPending,
  markSendIdempotencyComplete,
  markSendIdempotencyPending,
} from "@/lib/wallet/send-idempotency";
import { requireAdminWalletSendApi } from "@/lib/wallet/require-admin-wallet-send-api";

type SendBody = {
  recipient?: unknown;
  amount?: unknown;
  asset?: unknown;
  idempotencyKey?: unknown;
};

export async function POST(request: Request) {
  await connection();
  const gate = await requireAdminWalletSendApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!idempotencyKey || idempotencyKey.length < 8) {
    return NextResponse.json(
      { error: "idempotencyKey is required (min 8 characters)." },
      { status: 400 },
    );
  }

  const idem = checkSendIdempotencyKey(idempotencyKey);
  if (idem.action === "return") {
    return NextResponse.json({ txHash: idem.txHash, duplicate: true });
  }
  if (idem.action === "conflict") {
    return NextResponse.json(
      { error: "Send already in progress for this idempotency key." },
      { status: 409 },
    );
  }

  const parsed = await resolveAdminWalletSendValidation(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, field: parsed.field },
      { status: parsed.status },
    );
  }

  markSendIdempotencyPending(idempotencyKey);

  try {
    const execution = await executeAdminWalletSend({
      fromAddress: parsed.fromAddress,
      validated: parsed.validation,
    });

    if (execution.mode === "submitted") {
      markSendIdempotencyComplete(idempotencyKey, execution.txHash);
      return NextResponse.json({
        txHash: execution.txHash,
        chain: parsed.chain,
        explorerUrl: `https://basescan.org/tx/${execution.txHash}`,
      });
    }

    clearSendIdempotencyPending(idempotencyKey);
    return NextResponse.json({
      mode: "client",
      calls: execution.calls,
      recipient: parsed.validation.recipient,
      amount: parsed.validation.amountFormatted,
      asset: parsed.validation.asset,
      chain: parsed.chain,
      gas: {
        estimatedWei: parsed.gas.gasWei.toString(),
        estimatedEth: parsed.gas.gasEthFormatted,
        sponsoredByPaymaster: true,
      },
    });
  } catch (error) {
    clearSendIdempotencyPending(idempotencyKey);
    const message =
      error instanceof Error ? error.message : "Send failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
