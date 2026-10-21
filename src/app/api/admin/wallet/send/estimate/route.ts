import { connection, NextResponse } from "next/server";
import { resolveAdminWalletSendValidationSafe } from "@/lib/wallet/admin-wallet-send-request";
import { requireAdminWalletSendApi } from "@/lib/wallet/require-admin-wallet-send-api";

export async function POST(request: Request) {
  await connection();
  const gate = await requireAdminWalletSendApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = await resolveAdminWalletSendValidationSafe(
    body as Record<string, unknown>,
  );
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, ...(parsed.field ? { field: parsed.field } : {}) },
      { status: parsed.status },
    );
  }

  return NextResponse.json({
    from: parsed.fromAddress,
    recipient: parsed.validation.recipient,
    amount: parsed.validation.amountFormatted,
    warnings: parsed.validation.warnings,
    chain: parsed.chain,
    gas: {
      estimatedWei: parsed.gas.gasWei.toString(),
      estimatedEth: parsed.gas.gasEthFormatted,
      gasSponsorshipAvailable: parsed.gasSponsorshipAvailable,
    },
  });
}
