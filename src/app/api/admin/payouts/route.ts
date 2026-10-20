import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { loadAdminPayoutsSnapshot } from "@/lib/admin/admin-payouts";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";

export async function GET(request: Request) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let privyLinkedWalletAddresses: string[] | null = null;
  if (auth.mode === "privy_admin") {
    privyLinkedWalletAddresses =
      (await resolvePrivyLinkedChecksumWalletAddresses(
        request.headers.get("authorization"),
      )) ?? [];
  }

  const snapshot = await loadAdminPayoutsSnapshot(getDb(), {
    privyLinkedWalletAddresses,
  });
  return NextResponse.json(snapshot);
}
