import { connection } from "next/server";
import {
  earnActionsJsonResponse,
  readPrivyForwardHeaders,
  requireEarnActionsApi,
} from "@/lib/earn/require-earn-actions-api";
import { submitEarnAction } from "@/lib/earn/submit-earn-action";

type DepositBody = {
  walletId?: string;
  walletAddress?: string;
  vaultId?: string;
  rawAmount?: string;
};

export async function POST(request: Request) {
  await connection();
  const gate = await requireEarnActionsApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  let body: DepositBody;
  try {
    body = (await request.json()) as DepositBody;
  } catch {
    return earnActionsJsonResponse({ error: "invalid_json" }, { status: 400 });
  }

  const { authorizationSignature, idempotencyKey } =
    readPrivyForwardHeaders(request);

  const result = await submitEarnAction({
    userId: gate.ctx.userId,
    walletId: body.walletId?.trim() ?? "",
    walletAddress: body.walletAddress?.trim() ?? "",
    vaultId: body.vaultId?.trim() ?? "",
    rawAmount: body.rawAmount?.trim() ?? "",
    direction: "deposit",
    authorizationSignature: authorizationSignature ?? "",
    idempotencyKey: idempotencyKey ?? "",
  });

  return earnActionsJsonResponse(result.body, { status: result.status });
}
