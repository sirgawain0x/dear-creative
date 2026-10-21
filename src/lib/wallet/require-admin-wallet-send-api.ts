import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isWalletEnabled } from "./feature-flag";
import { isWalletSendEnabled } from "./send-feature-flag";

export type AdminWalletSendApiContext = {
  userId: string;
};

export type AdminWalletSendApiGateResult =
  | { ok: true; ctx: AdminWalletSendApiContext }
  | { ok: false; response: NextResponse };

export function walletSendFeatureDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function requireAdminWalletSendApi(
  request: Request,
): Promise<AdminWalletSendApiGateResult> {
  if (!isWalletSendEnabled()) {
    return { ok: false, response: walletSendFeatureDisabledResponse() };
  }

  if (!isWalletEnabled()) {
    return { ok: false, response: walletSendFeatureDisabledResponse() };
  }

  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }

  return { ok: true, ctx: { userId: auth.user.userId } };
}
