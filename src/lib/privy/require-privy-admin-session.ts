import { NextResponse } from "next/server";
import {
  type CookieReader,
  getPrivyUserIdFromCookies,
  isPrivyAdminUserId,
} from "./session-from-cookies";
import { extractBearerToken, verifyPrivyAccessToken } from "./verify";

export type PrivyAdminSessionResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function resolvePrivyAdminUserForLinkedIn(
  request: Request,
  readCookie: CookieReader,
): Promise<{ userId: string | null; isAdmin: boolean }> {
  let userId = await getPrivyUserIdFromCookies(readCookie);

  if (!userId) {
    const bearer = extractBearerToken(request.headers.get("authorization"));
    if (bearer) {
      try {
        userId = (await verifyPrivyAccessToken(bearer)).userId;
      } catch {
        userId = null;
      }
    }
  }

  const isAdmin = userId != null && isPrivyAdminUserId(userId);
  return { userId, isAdmin };
}

export async function requirePrivyAdminSession(
  request: Request,
  readCookie: CookieReader,
): Promise<PrivyAdminSessionResult> {
  const { userId, isAdmin } = await resolvePrivyAdminUserForLinkedIn(
    request,
    readCookie,
  );

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId };
}
