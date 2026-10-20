import {
  exchangeLinkedInAuthorizationCode,
  fetchLinkedInUserInfo,
} from "./oauth";
import { validateLinkedInOAuthState } from "./oauth-state";
import { saveLinkedInPersonalCredentials } from "./token-store";

export type CompleteLinkedInOAuthInput = {
  code: string | null;
  state: string | null;
  cookieState: string | undefined;
  oauthError?: string | null;
};

export type CompleteLinkedInOAuthResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function completeLinkedInOAuth(
  input: CompleteLinkedInOAuthInput,
): Promise<CompleteLinkedInOAuthResult> {
  if (input.oauthError) {
    return { ok: false, reason: input.oauthError };
  }
  if (
    !input.code ||
    !input.state ||
    !input.cookieState ||
    input.state !== input.cookieState ||
    !validateLinkedInOAuthState(input.state)
  ) {
    return { ok: false, reason: "invalid_state" };
  }

  try {
    const token = await exchangeLinkedInAuthorizationCode(input.code);
    const userinfo = await fetchLinkedInUserInfo(token.access_token);
    await saveLinkedInPersonalCredentials({
      memberSub: userinfo.sub,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresInSeconds: token.expires_in,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "exchange_failed" };
  }
}
