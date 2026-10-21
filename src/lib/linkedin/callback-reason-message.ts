import {
  isLinkedInCallbackReasonCode,
  type LinkedInCallbackReasonCode,
} from "./reason-codes";

const LINKEDIN_CALLBACK_REASON_MESSAGES: Record<
  LinkedInCallbackReasonCode,
  string
> = {
  connected: "LinkedIn connected successfully.",
  invalid_state:
    "LinkedIn authorization could not be verified. Start connect again from the admin page.",
  session_missing:
    "Your Privy session was missing during LinkedIn callback. Sign in and try again.",
  not_admin: "Only Privy admins can connect LinkedIn for Adam posting.",
  did_mismatch:
    "The Privy account that started LinkedIn connect did not match the signed-in admin.",
  user_cancelled: "LinkedIn authorization was cancelled.",
  access_denied: "LinkedIn denied access to the requested permissions.",
  oauth_invalid_request: "LinkedIn rejected the authorization request.",
  oauth_unauthorized_client: "This app's LinkedIn client is not authorized.",
  oauth_unsupported_response: "LinkedIn returned an unsupported OAuth response.",
  oauth_invalid_scope: "LinkedIn rejected the requested OAuth scopes.",
  oauth_server_error: "LinkedIn reported a server error. Try again later.",
  oauth_temporarily_unavailable:
    "LinkedIn authorization is temporarily unavailable. Try again later.",
  oauth_denied: "LinkedIn authorization was denied.",
  token_exchange_failed:
    "LinkedIn token exchange failed. Check app credentials and try again.",
  userinfo_failed: "LinkedIn profile lookup failed after authorization.",
  linkedin_post_failed: "LinkedIn post delivery failed.",
  linkedin_reauth_required: "LinkedIn access expired. Reconnect your profile.",
  linkedin_posting_disabled: "LinkedIn posting is disabled for this environment.",
};

export function linkedInCallbackReasonMessage(
  reason: string | null | undefined,
): string | null {
  if (!reason?.trim()) {
    return null;
  }
  if (!isLinkedInCallbackReasonCode(reason)) {
    return "LinkedIn connection failed. Try connecting again.";
  }
  return LINKEDIN_CALLBACK_REASON_MESSAGES[reason];
}
