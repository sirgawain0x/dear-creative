import { describe, expect, it } from "vitest";
import { linkedInCallbackReasonMessage } from "./callback-reason-message";

describe("linkedInCallbackReasonMessage", () => {
  it("returns readable copy for known reason codes", () => {
    expect(linkedInCallbackReasonMessage("invalid_state")).toContain(
      "could not be verified",
    );
    expect(linkedInCallbackReasonMessage("user_cancelled")).toContain("cancelled");
  });

  it("returns generic copy for unknown reason codes", () => {
    expect(linkedInCallbackReasonMessage("totally_unknown")).toBe(
      "LinkedIn connection failed. Try connecting again.",
    );
  });
});
