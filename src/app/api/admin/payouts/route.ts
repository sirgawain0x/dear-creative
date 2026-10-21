import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { loadAdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { requirePrivyAuth } from "@/lib/privy/require-auth";

export async function GET(request: Request) {
  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return auth.response;
  }

  const privyLinkedWalletAddresses =
    (await resolvePrivyLinkedChecksumWalletAddresses(
      request.headers.get("authorization"),
    )) ?? [];

  const snapshot = await loadAdminPayoutsSnapshot(getDb(), {
    privyLinkedWalletAddresses,
  });
  return NextResponse.json(snapshot);
}
