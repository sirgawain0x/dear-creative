import {
  LINKEDIN_CALLBACK_SUCCESS_MESSAGE,
  linkedInCallbackErrorMessage,
} from "./callback-banner-messages";

export type LinkedInCallbackBanner =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function readLinkedInCallbackBanner(
  params: Pick<URLSearchParams, "get">,
): LinkedInCallbackBanner | null {
  const linkedin = params.get("linkedin")?.trim();
  if (linkedin === "connected") {
    return {
      kind: "success",
      message: LINKEDIN_CALLBACK_SUCCESS_MESSAGE,
    };
  }
  if (linkedin === "error") {
    return {
      kind: "error",
      message: linkedInCallbackErrorMessage(params.get("reason")),
    };
  }
  return null;
}
