import { STUDIO_TOKEN_STORAGE_KEY } from "@/components/providers/app-providers";

export function readStudioTokenFromStorage(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(STUDIO_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

/**
 * Prefer Privy access token when configured and authenticated; fall back to Studio key in localStorage.
 */
export async function resolveStudioBearerToken(options: {
  privyConfigured: boolean;
  authenticated: boolean;
  getAccessToken: () => Promise<string | null>;
  studioTokenFromStorage?: string;
}): Promise<string | null> {
  let token: string | null = null;
  if (options.privyConfigured && options.authenticated) {
    try {
      token = await options.getAccessToken();
    } catch {
      token = null;
    }
  }
  const studio = (options.studioTokenFromStorage ?? readStudioTokenFromStorage()).trim();
  if (!token && studio) {
    token = studio;
  }
  return token?.trim() ? token.trim() : null;
}

export async function fetchWithStudioBearerToken(
  url: string,
  init: RequestInit,
  auth: {
    privyConfigured: boolean;
    authenticated: boolean;
    getAccessToken: () => Promise<string | null>;
    studioTokenFromStorage?: string;
  },
): Promise<Response> {
  const token = await resolveStudioBearerToken(auth);
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
