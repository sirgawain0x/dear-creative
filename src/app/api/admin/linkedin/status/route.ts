import { NextResponse } from "next/server";
import { toLinkedInAdminConnectionStatus } from "@/lib/linkedin/admin-status";
import { loadLinkedInPersonalCredentials } from "@/lib/linkedin/token-store";
import { requirePrivyAuth } from "@/lib/privy/require-auth";

export async function GET(request: Request) {
  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return auth.response;
  }

  const creds = await loadLinkedInPersonalCredentials();
  return NextResponse.json(toLinkedInAdminConnectionStatus(creds));
}
