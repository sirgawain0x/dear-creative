import { describe, expect, it } from "vitest";
import { LINKEDIN_CALLBACK_SUCCESS_MESSAGE } from "./callback-banner-messages";
import { linkedInCallbackErrorMessage } from "./callback-banner-messages";
import { readLinkedInCallbackBanner } from "./read-linkedin-callback-banner";

describe("readLinkedInCallbackBanner", () => {
  it("returns success banner for linkedin=connected", () => {
    const params = new URLSearchParams("linkedin=connected");
    expect(readLinkedInCallbackBanner(params)).toEqual({
      kind: "success",
      message: LINKEDIN_CALLBACK_SUCCESS_MESSAGE,
    });
  });

  it("returns error banner for linkedin=error", () => {
    const params = new URLSearchParams("linkedin=error&reason=session_missing");
    expect(readLinkedInCallbackBanner(params)?.message).toBe(
      linkedInCallbackErrorMessage("session_missing"),
    );
  });

  it("returns null when linkedin param is absent", () => {
    expect(readLinkedInCallbackBanner(new URLSearchParams())).toBeNull();
  });
});
