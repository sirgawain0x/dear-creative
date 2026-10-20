import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isWalletEnabled } from "./feature-flag";

export type AdminWalletApiContext = {
  userId: string;
};

export type AdminWalletApiGateResult =
  | { ok: true; ctx: AdminWalletApiContext }
  | { ok: false; response: NextResponse };

export function walletFeatureDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function requireAdminWalletApi(
  request: Request,
): Promise<AdminWalletApiGateResult> {
  if (!isWalletEnabled()) {
    return { ok: false, response: walletFeatureDisabledResponse() };
  }

  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }

  return { ok: true, ctx: { userId: auth.user.userId } };
}
