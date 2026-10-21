import { connection, NextResponse } from "next/server";
import { resolveAdminWalletSendValidationSafe } from "@/lib/wallet/admin-wallet-send-request";
import { requireAdminWalletSendApi } from "@/lib/wallet/require-admin-wallet-send-api";

type SendBody = {
  recipient?: unknown;
  amount?: unknown;
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

  const parsed = await resolveAdminWalletSendValidationSafe(body);
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
    chain: parsed.chain,
    transaction: {
      to: parsed.call.to,
      data: parsed.call.data,
      value: parsed.call.value.toString(),
      chainId: parsed.chain.chainId,
    },
    gas: {
      estimatedWei: parsed.gas.gasWei.toString(),
      estimatedEth: parsed.gas.gasEthFormatted,
      gasSponsorshipAvailable: parsed.gasSponsorshipAvailable,
    },
  });
}
