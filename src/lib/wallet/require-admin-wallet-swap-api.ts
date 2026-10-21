import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isWalletEnabled } from "./feature-flag";
import { isWalletSwapEnabled } from "./swap-feature-flag";

export type AdminWalletSwapApiContext = {
  userId: string;
};

export type AdminWalletSwapApiGateResult =
  | { ok: true; ctx: AdminWalletSwapApiContext }
  | { ok: false; response: NextResponse };

export function walletSwapFeatureDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function requireAdminWalletSwapApi(
  request: Request,
): Promise<AdminWalletSwapApiGateResult> {
  if (!isWalletSwapEnabled()) {
    return { ok: false, response: walletSwapFeatureDisabledResponse() };
  }

  if (!isWalletEnabled()) {
    return { ok: false, response: walletSwapFeatureDisabledResponse() };
  }

  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }

  return { ok: true, ctx: { userId: auth.user.userId } };
}
