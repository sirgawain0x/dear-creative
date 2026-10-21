import { connection } from "next/server";
import { fetchPrivyWalletAction } from "@/lib/earn/privy-earn-actions";
import {
  earnActionsJsonResponse,
  requireEarnActionsApi,
} from "@/lib/earn/require-earn-actions-api";
import { assertEarnWalletAccess } from "@/lib/earn/wallet-access";

export async function GET(request: Request) {
  await connection();
  const gate = await requireEarnActionsApi(request);
  if (!gate.ok) {
    return gate.response;
  }

  const url = new URL(request.url);
  const walletId = url.searchParams.get("walletId")?.trim() ?? "";
  const walletAddress = url.searchParams.get("walletAddress")?.trim() ?? "";
  const actionId = url.searchParams.get("actionId")?.trim() ?? "";

  if (!walletId || !walletAddress || !actionId) {
    return earnActionsJsonResponse(
      { error: "missing_parameters" },
      { status: 400 },
    );
  }

  const access = await assertEarnWalletAccess({
    userId: gate.ctx.userId,
    walletId,
    walletAddress,
  });
  if (!access.ok) {
    const status = access.code === "wallet_not_owned" ? 403 : 400;
    return earnActionsJsonResponse({ error: access.code }, { status });
  }

  try {
    const action = await fetchPrivyWalletAction(walletId, actionId);
    return earnActionsJsonResponse({ action });
  } catch {
    return earnActionsJsonResponse(
      { error: "action_status_unavailable" },
      { status: 502 },
    );
  }
}
