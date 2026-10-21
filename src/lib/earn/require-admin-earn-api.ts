import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isEarnEnabled } from "./feature-flag";

export type AdminEarnApiContext = {
  userId: string;
};

export type AdminEarnApiGateResult =
  | { ok: true; ctx: AdminEarnApiContext }
  | { ok: false; response: NextResponse };

const ADMIN_EARN_CACHE_CONTROL = "private, no-store";

export function earnFeatureDisabledResponse(): NextResponse {
  return adminEarnJsonResponse({ error: "Not found" }, { status: 404 });
}

export function adminEarnJsonResponse(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", ADMIN_EARN_CACHE_CONTROL);
  return NextResponse.json(body, { ...init, headers });
}

export async function requireAdminEarnApi(
  request: Request,
): Promise<AdminEarnApiGateResult> {
  if (!isEarnEnabled()) {
    return { ok: false, response: earnFeatureDisabledResponse() };
  }

  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    const headers = new Headers(auth.response.headers);
    headers.set("Cache-Control", ADMIN_EARN_CACHE_CONTROL);
    return {
      ok: false,
      response: new NextResponse(auth.response.body, {
        status: auth.response.status,
        statusText: auth.response.statusText,
        headers,
      }),
    };
  }

  return { ok: true, ctx: { userId: auth.user.userId } };
}
