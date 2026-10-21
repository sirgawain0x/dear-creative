import { NextResponse } from "next/server";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isAuthorProfilesEnabled } from "./feature-flag";

export type AuthorEditAuthResult =
  | { ok: true; privyUserId: string; isAdmin: true }
  | { ok: false; response: NextResponse };

/**
 * Profile edit APIs and /authors/[id]/edit are Privy-admin only.
 *
 * TODO: Writer self-edit will use a dedicated login-wallet column (not
 * payout_address, which may be a Split contract). That needs a separate
 * migration and G2 OK before apply.
 */
export async function requireAuthorProfileEditAccess(
  request: Request,
): Promise<AuthorEditAuthResult> {
  if (!isAuthorProfilesEnabled()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const privyResult = await requirePrivyAuth(request, { requireAdmin: true });
  if (!privyResult.ok) {
    return privyResult;
  }

  return {
    ok: true,
    privyUserId: privyResult.user.userId,
    isAdmin: true,
  };
}
