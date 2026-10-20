import { describe, expect, it } from "vitest";
import { buildPublicPostTeaser } from "./post-public-teaser";

describe("buildPublicPostTeaser", () => {
  it("prefers stored excerpt and decodes HTML entities", () => {
    expect(
      buildPublicPostTeaser({
        excerpt: "Hello &amp; welcome",
        publicPreview: "Preview text",
      }),
    ).toBe("Hello & welcome");
  });

  it("uses free public preview when excerpt is missing", () => {
    expect(
      buildPublicPostTeaser({
        excerpt: null,
        publicPreview: "## Intro\n\n**Bold** preview line.",
      }),
    ).toBe("Intro Bold preview line.");
  });

  it("returns undefined when neither excerpt nor preview exists", () => {
    expect(
      buildPublicPostTeaser({ excerpt: null, publicPreview: null }),
    ).toBeUndefined();
  });
});
