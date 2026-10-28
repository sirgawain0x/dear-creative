import { describe, expect, it } from "vitest";
import { parseNewsletterIncludeTypes } from "./newsletter-includes";

describe("parseNewsletterIncludeTypes", () => {
  it("filters unknown types and preserves order", () => {
    expect(
      parseNewsletterIncludeTypes(["mind_map", "audio_overview", "quiz", "nope"]),
    ).toEqual(["mind_map", "quiz"]);
  });
});
