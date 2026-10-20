import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { buildLinkedInAuthorizationUrl } from "@/lib/linkedin/oauth";
import { createLinkedInOAuthState } from "@/lib/linkedin/oauth-state";
import { isLinkedInOAuthConfigured } from "@/lib/linkedin/config";

export const LINKEDIN_OAUTH_STATE_COOKIE = "linkedin_oauth_state";

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

  const state = createLinkedInOAuthState();
  const redirectUrl = buildLinkedInAuthorizationUrl(state);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(LINKEDIN_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/linkedin/callback",
    maxAge: 15 * 60,
  });
  return response;
}
