import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { readRequestCookieHeader } from "@/lib/privy/session-from-cookies";
import { isAdamApiToken, requireAdamAuth } from "./require-auth";
import { ADAM_STUDIO_KEY_COOKIE } from "./studio-access";

export type StudioAuthSuccess = {
  ok: true;
  actor: string;
  mode: "privy_admin" | "adam_token" | "studio_key";
};

export type StudioAuthResult =
  | StudioAuthSuccess
  | { ok: false; response: NextResponse };

/**
 * Authenticates requests coming either from the Privy-protected /adam studio UI
 * or from the Adam service / Cloud Scheduler using ADAM_API_TOKEN.
 *
 * The Studio Key may arrive as an `Authorization: Bearer` header (service
 * callers) or as the httpOnly cookie set by /api/adam/studio-key (browser
 * fallback when Privy sign-in is unavailable). Both compare in constant time.
 */
export async function requireStudioOrAdamAuth(
  request: Request,
): Promise<StudioAuthResult> {
  const adamToken = process.env.ADAM_API_TOKEN?.trim();
  const authHeader = request.headers.get("authorization")?.trim() ?? "";

  if (adamToken && authHeader === `Bearer ${adamToken}`) {
    const adamCheck = requireAdamAuth(request);
    if (adamCheck.ok) {
      return { ok: true, actor: "adam-token", mode: "adam_token" };
    }
  }

  const studioKeyCookie = readRequestCookieHeader(
    request.headers.get("cookie"),
    ADAM_STUDIO_KEY_COOKIE,
  );
  if (isAdamApiToken(studioKeyCookie)) {
    return { ok: true, actor: "studio-key", mode: "studio_key" };
  }

  const privyCheck = await requirePrivyAuth(request, { requireAdmin: true });
  if (privyCheck.ok) {
    return {
      ok: true,
      actor: privyCheck.user.userId,
      mode: "privy_admin",
    };
  }

  return privyCheck;
}
