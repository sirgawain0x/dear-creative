import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isEarnActionsEnabled } from "./actions-feature-flag";

export type EarnActionsApiContext = {
  userId: string;
};

export type EarnActionsApiGateResult =
  | { ok: true; ctx: EarnActionsApiContext }
  | { ok: false; response: NextResponse };

const EARN_ACTIONS_CACHE_CONTROL = "private, no-store";

export function earnActionsDisabledResponse(): NextResponse {
  return earnActionsJsonResponse({ error: "Not found" }, { status: 404 });
}

export function earnActionsJsonResponse(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", EARN_ACTIONS_CACHE_CONTROL);
  return NextResponse.json(body, { ...init, headers });
}

export async function requireEarnActionsApi(
  request: Request,
): Promise<EarnActionsApiGateResult> {
  if (!isEarnActionsEnabled()) {
    return { ok: false, response: earnActionsDisabledResponse() };
  }

  const auth = await requirePrivyAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    return { ok: false, response: earnActionsDisabledResponse() };
  }

  return { ok: true, ctx: { userId: auth.user.userId } };
}

export function readPrivyForwardHeaders(request: Request): {
  authorizationSignature: string | null;
  idempotencyKey: string | null;
} {
  return {
    authorizationSignature: request.headers
      .get("privy-authorization-signature")
      ?.trim() ?? null,
    idempotencyKey:
      request.headers.get("privy-idempotency-key")?.trim() ?? null,
  };
}
