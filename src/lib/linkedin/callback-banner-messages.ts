import {
  isLinkedInCallbackReasonCode,
  type LinkedInCallbackReasonCode,
} from "./reason-codes";

export const LINKEDIN_CALLBACK_SUCCESS_MESSAGE =
  "LinkedIn is connected. Adam can post from your personal profile when posting is enabled.";

const LINKEDIN_CALLBACK_ERROR_MESSAGES: Record<
  Exclude<LinkedInCallbackReasonCode, "connected">,
  string
> = {
  session_missing:
    "Your login wasn't sent back from LinkedIn; sign out and in, then retry",
  not_admin: "Only Privy admins can connect LinkedIn on this console.",
  invalid_state:
    "This LinkedIn authorization link expired or was already used. Start Connect LinkedIn again.",
  did_mismatch:
    "The Privy account that returned from LinkedIn does not match the one that started the flow. Sign in as the same admin and retry.",
  user_cancelled: "LinkedIn sign-in was cancelled before finishing.",
  access_denied: "LinkedIn denied access for this app.",
  oauth_invalid_request:
    "LinkedIn rejected the authorization request. Try Connect LinkedIn again.",
  oauth_unauthorized_client:
    "LinkedIn rejected the app client configuration. Check OAuth app settings.",
  oauth_unsupported_response:
    "LinkedIn returned an unsupported OAuth response. Try again later.",
  oauth_invalid_scope:
    "LinkedIn rejected the requested permissions. Check OAuth scopes on the app.",
  oauth_server_error: "LinkedIn had a server error during authorization. Try again later.",
  oauth_temporarily_unavailable:
    "LinkedIn authorization is temporarily unavailable. Try again in a few minutes.",
  oauth_denied: "LinkedIn denied the authorization request.",
  token_exchange_failed:
    "LinkedIn accepted the sign-in but token exchange failed. Try Connect LinkedIn again.",
  userinfo_failed:
    "LinkedIn tokens were issued but profile lookup failed. Try Connect LinkedIn again.",
  linkedin_post_failed: "LinkedIn posting failed after connect.",
  linkedin_reauth_required: "LinkedIn access expired; connect again from Admin.",
  linkedin_posting_disabled: "LinkedIn posting is disabled in this environment.",
};

export const LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE =
  "LinkedIn connect failed for an unknown reason. Try Connect LinkedIn again.";

/** Human-readable error copy for `reason` query values emitted by the OAuth callback. */
export function linkedInCallbackErrorMessage(
  reason: string | null | undefined,
): string {
  const code = reason?.trim();
  if (!code) {
    return LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE;
  }
  if (isLinkedInCallbackReasonCode(code) && code !== "connected") {
    return LINKEDIN_CALLBACK_ERROR_MESSAGES[code];
  }
  return LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE;
}
