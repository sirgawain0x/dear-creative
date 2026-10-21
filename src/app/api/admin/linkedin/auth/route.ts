import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isLinkedInOAuthConfigured } from "@/lib/linkedin/config";
import { buildLinkedInAuthStartResponse } from "@/lib/linkedin/auth-response";

export { LINKEDIN_OAUTH_STATE_COOKIE } from "@/lib/linkedin/auth-response";

export async function GET(request: Request) {
  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return auth.response;
  }

  if (!isLinkedInOAuthConfigured()) {
    return NextResponse.json(
      { error: "linkedin_oauth_not_configured" },
      { status: 503 },
    );
  }

  return buildLinkedInAuthStartResponse(auth.user.userId);
}
