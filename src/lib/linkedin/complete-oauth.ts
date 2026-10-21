import {
  exchangeLinkedInAuthorizationCode,
  fetchLinkedInUserInfo,
  linkedInUserInfoDisplayName,
} from "./oauth";
import {
  parseLinkedInOAuthState,
} from "./oauth-state";
import {
  mapLinkedInOAuthErrorParam,
  type LinkedInCallbackReasonCode,
} from "./reason-codes";
import { saveLinkedInPersonalCredentials } from "./token-store";

export type CompleteLinkedInOAuthInput = {
  code: string | null;
  state: string | null;
  cookieState: string | undefined;
  oauthError?: string | null;
  privyUserId: string | null;
  isPrivyAdmin: boolean;
  nowMs?: number;
};

export type CompleteLinkedInOAuthResult =
  | { ok: true; reason: "connected" }
  | { ok: false; reason: LinkedInCallbackReasonCode };

export async function completeLinkedInOAuth(
  input: CompleteLinkedInOAuthInput,
): Promise<CompleteLinkedInOAuthResult> {
  const nowMs = input.nowMs ?? Date.now();

  if (input.oauthError) {
    return {
      ok: false,
      reason: mapLinkedInOAuthErrorParam(input.oauthError),
    };
  }

  if (!input.privyUserId) {
    return { ok: false, reason: "session_missing" };
  }

  if (!input.isPrivyAdmin) {
    return { ok: false, reason: "not_admin" };
  }

  if (
    !input.code ||
    !input.state ||
    !input.cookieState ||
    input.state !== input.cookieState
  ) {
    return { ok: false, reason: "invalid_state" };
  }

  const parsed = parseLinkedInOAuthState(input.state);
  if (!parsed || nowMs > parsed.expiresAtMs) {
    return { ok: false, reason: "invalid_state" };
  }

  if (parsed.privyUserId !== input.privyUserId) {
    return { ok: false, reason: "did_mismatch" };
  }

  try {
    const token = await exchangeLinkedInAuthorizationCode(input.code);
    const userinfo = await fetchLinkedInUserInfo(token.access_token);
    await saveLinkedInPersonalCredentials({
      memberSub: userinfo.sub,
      memberDisplayName: linkedInUserInfoDisplayName(userinfo),
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresInSeconds: token.expires_in,
      nowMs,
    });
    return { ok: true, reason: "connected" };
  } catch (err) {
    if (err instanceof Error && err.message === "linkedin_userinfo_failed") {
      return { ok: false, reason: "userinfo_failed" };
    }
    return { ok: false, reason: "token_exchange_failed" };
  }
}
