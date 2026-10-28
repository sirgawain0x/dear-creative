import { describe, expect, it } from "vitest";
import { LINKEDIN_CALLBACK_REASONS } from "./reason-codes";
import {
  LINKEDIN_CALLBACK_SUCCESS_MESSAGE,
  LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE,
  linkedInCallbackErrorMessage,
} from "./callback-banner-messages";

const OAUTH_CALLBACK_ERROR_REASONS = LINKEDIN_CALLBACK_REASONS.filter(
  (code) => code !== "connected",
);

describe("linkedInCallbackErrorMessage", () => {
  it("maps every OAuth callback error reason to non-empty copy", () => {
    for (const reason of OAUTH_CALLBACK_ERROR_REASONS) {
      const message = linkedInCallbackErrorMessage(reason);
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toBe(LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE);
    }
  });

  it("uses the required session_missing copy", () => {
    expect(linkedInCallbackErrorMessage("session_missing")).toBe(
      "Your login wasn't sent back from LinkedIn; sign out and in, then retry",
    );
  });

  it("falls back for unknown reason codes", () => {
    expect(linkedInCallbackErrorMessage("totally_unknown_reason_xyz")).toBe(
      LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE,
    );
    expect(linkedInCallbackErrorMessage("")).toBe(
      LINKEDIN_CALLBACK_UNKNOWN_REASON_MESSAGE,
    );
  });

  it("exposes success message constant", () => {
    expect(LINKEDIN_CALLBACK_SUCCESS_MESSAGE).toMatch(/connected/i);
  });
});
