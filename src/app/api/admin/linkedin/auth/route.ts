import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isLinkedInOAuthConfigured } from "@/lib/linkedin/config";
import { buildLinkedInAuthStartResponse } from "@/lib/linkedin/auth-response";
import { createCookieReaderFromHeader } from "@/lib/privy/session-from-cookies";
import { requirePrivyAdminSession } from "@/lib/privy/require-privy-admin-session";

export { LINKEDIN_OAUTH_STATE_COOKIE } from "@/lib/linkedin/auth-response";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const headerReader = createCookieReaderFromHeader(
    request.headers.get("cookie"),
  );
  const readCookie = (name: string) =>
    cookieStore.get(name)?.value ?? headerReader(name);

  const auth = await requirePrivyAdminSession(request, readCookie);
  if (!auth.ok) {
    return auth.response;
  }

  if (!isLinkedInOAuthConfigured()) {
    return NextResponse.json(
      { error: "linkedin_oauth_not_configured" },
      { status: 503 },
    );
  }

  return buildLinkedInAuthStartResponse(auth.userId);
}
