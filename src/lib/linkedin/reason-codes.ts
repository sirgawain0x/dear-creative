export const LINKEDIN_CALLBACK_REASONS = [
  "connected",
  "invalid_state",
  "session_missing",
  "not_admin",
  "did_mismatch",
  "user_cancelled",
  "access_denied",
  "oauth_invalid_request",
  "oauth_unauthorized_client",
  "oauth_unsupported_response",
  "oauth_invalid_scope",
  "oauth_server_error",
  "oauth_temporarily_unavailable",
  "oauth_denied",
  "token_exchange_failed",
  "userinfo_failed",
  "linkedin_post_failed",
  "linkedin_reauth_required",
  "linkedin_posting_disabled",
] as const;

export type LinkedInCallbackReasonCode =
  (typeof LINKEDIN_CALLBACK_REASONS)[number];

export function mapLinkedInOAuthErrorParam(
  error: string | null | undefined,
): LinkedInCallbackReasonCode {
  switch (error?.trim()) {
    case "user_cancelled_login":
    case "user_cancelled_authorize":
      return "user_cancelled";
    case "access_denied":
      return "access_denied";
    case "invalid_request":
      return "oauth_invalid_request";
    case "unauthorized_client":
      return "oauth_unauthorized_client";
    case "unsupported_response_type":
      return "oauth_unsupported_response";
    case "invalid_scope":
      return "oauth_invalid_scope";
    case "server_error":
      return "oauth_server_error";
    case "temporarily_unavailable":
      return "oauth_temporarily_unavailable";
    default:
      return "oauth_denied";
  }
}

export function isLinkedInCallbackReasonCode(
  value: string,
): value is LinkedInCallbackReasonCode {
  return (LINKEDIN_CALLBACK_REASONS as readonly string[]).includes(value);
}
