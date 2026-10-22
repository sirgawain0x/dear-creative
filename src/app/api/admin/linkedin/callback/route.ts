import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeLinkedInOAuth } from "@/lib/linkedin/complete-oauth";
import { isLinkedInOAuthConfigured } from "@/lib/linkedin/config";
import {
  LINKEDIN_OAUTH_STATE_COOKIE,
  LINKEDIN_OAUTH_STATE_COOKIE_PATH,
} from "@/lib/linkedin/auth-response";
import { resolvePrivyAdminUserForLinkedIn } from "@/lib/privy/require-privy-admin-session";
import { createCookieReaderFromHeader } from "@/lib/privy/session-from-cookies";

function redirectWithReason(
  request: Request,
  reason: string,
  connected = false,
): NextResponse {
  const base = new URL(request.url);
  const target = new URL("/admin", base.origin);
  if (connected) {
    target.searchParams.set("linkedin", "connected");
  } else {
    target.searchParams.set("linkedin", "error");
    target.searchParams.set("reason", reason);
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

  const cookieStore = await cookies();
  const headerReader = createCookieReaderFromHeader(
    request.headers.get("cookie"),
  );
  const readCookie = (name: string) =>
    cookieStore.get(name)?.value ?? headerReader(name);

  const { userId: privyUserId, isAdmin: isPrivyAdmin } =
    await resolvePrivyAdminUserForLinkedIn(request, readCookie);

  const url = new URL(request.url);
  const cookieState = readCookie(LINKEDIN_OAUTH_STATE_COOKIE);

  const result = await completeLinkedInOAuth({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    cookieState,
    oauthError: url.searchParams.get("error"),
    privyUserId,
    isPrivyAdmin,
  });

  cookieStore.delete({
    name: LINKEDIN_OAUTH_STATE_COOKIE,
    path: LINKEDIN_OAUTH_STATE_COOKIE_PATH,
  });

  if (result.ok) {
    return redirectWithReason(request, result.reason, true);
  }
  console.error("[admin-linkedin] oauth_callback_failed", {
    reason: result.reason,
  });
  return redirectWithReason(request, result.reason);
}
