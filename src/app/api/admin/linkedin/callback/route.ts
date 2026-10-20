import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeLinkedInOAuth } from "@/lib/linkedin/complete-oauth";
import { isLinkedInOAuthConfigured } from "@/lib/linkedin/config";
import { LINKEDIN_OAUTH_STATE_COOKIE } from "../auth/route";

function redirectWithStatus(
  request: Request,
  params: Record<string, string>,
): NextResponse {
  const base = new URL(request.url);
  const target = new URL("/admin", base.origin);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  if (!isLinkedInOAuthConfigured()) {
    return NextResponse.json(
      { error: "linkedin_oauth_not_configured" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(LINKEDIN_OAUTH_STATE_COOKIE)?.value;

  const result = await completeLinkedInOAuth({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    cookieState,
    oauthError: url.searchParams.get("error"),
  });

  cookieStore.delete(LINKEDIN_OAUTH_STATE_COOKIE);

  if (!result.ok) {
    return redirectWithStatus(request, { linkedin: "error", reason: result.reason });
  }

  return redirectWithStatus(request, { linkedin: "connected" });
}
