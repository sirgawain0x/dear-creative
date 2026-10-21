import { getPrivyAdminUserIds } from "./config";
import { getPrivyServerClient } from "./server-client";

export const PRIVY_ACCESS_TOKEN_COOKIE = "privy-token";
export const PRIVY_ID_TOKEN_COOKIE = "privy-id-token";

export type CookieReader = (name: string) => string | undefined;

let cookieReaderOverride: CookieReader | undefined;

export function setPrivyCookieReaderForTests(reader: CookieReader | undefined): void {
  cookieReaderOverride = reader;
}

export function readRequestCookieHeader(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) {
      continue;
    }
    const raw = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function createCookieReaderFromHeader(
  cookieHeader: string | null,
): CookieReader {
  return (name) => readRequestCookieHeader(cookieHeader, name);
}

export async function getPrivyUserIdFromCookies(
  readCookie: CookieReader,
): Promise<string | null> {
  const client = getPrivyServerClient();
  if (!client) {
    return null;
  }

  const accessToken = readCookie(PRIVY_ACCESS_TOKEN_COOKIE);
  if (accessToken) {
    try {
      const claims = await client.verifyAuthToken(accessToken);
      return claims.userId;
    } catch {
      // fall through to identity token
    }
  }

  const idToken = readCookie(PRIVY_ID_TOKEN_COOKIE);
  if (idToken) {
    try {
      const user = await client.getUser({ idToken });
      return user.id;
    } catch {
      return null;
    }
  }

  return null;
}

export function isPrivyAdminUserId(userId: string): boolean {
  const allowlist = getPrivyAdminUserIds();
  if (allowlist.size === 0) {
    return false;
  }
  return allowlist.has(userId);
}

export async function getPrivyAdminSessionFromCookies(
  readCookie: CookieReader,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: "session_missing" | "not_admin" }
> {
  const userId = await getPrivyUserIdFromCookies(readCookie);
  if (!userId) {
    return { ok: false, reason: "session_missing" };
  }
  if (!isPrivyAdminUserId(userId)) {
    return { ok: false, reason: "not_admin" };
  }
  return { ok: true, userId };
}
