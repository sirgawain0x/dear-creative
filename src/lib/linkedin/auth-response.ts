import { NextResponse } from "next/server";
import { buildLinkedInAuthorizationUrl } from "./oauth";
import { createLinkedInOAuthState } from "./oauth-state";

export const LINKEDIN_OAUTH_STATE_COOKIE = "linkedin_oauth_state";
const STATE_COOKIE_MAX_AGE_SEC = 15 * 60;

export function buildLinkedInAuthStartResponse(privyUserId: string): NextResponse {
  const state = createLinkedInOAuthState(privyUserId);
  const url = buildLinkedInAuthorizationUrl(state).toString();
  const response = NextResponse.json({ url });
  response.cookies.set(LINKEDIN_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/linkedin/callback",
    maxAge: STATE_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
