import { describe, expect, it } from "vitest";
import {
  buildPostSpotlightTeaser,
  truncatePlainTextTeaser,
} from "./post-spotlight-teaser";

describe("post spotlight teaser", () => {
  it("prefers the post excerpt when present", () => {
    expect(
      buildPostSpotlightTeaser({
        excerpt: "Short excerpt",
        bodyHtml: "<p>Long body</p>",
      }),
    ).toBe("Short excerpt");
  });

  it("strips HTML and markdown then truncates at a word boundary with an ellipsis", () => {
    const body = [
      "## Headline",
      "",
      "Hello **world** — this is a [link](https://example.com) and ![img](https://example.com/x.png)",
      "with enough plain text to exceed one hundred sixty characters easily so truncation",
      "should land on a word boundary rather than mid-token for readability in cards.",
    ].join("\n");

    const teaser = buildPostSpotlightTeaser({ bodyHtml: body });
    expect(teaser).toBeDefined();
    expect(teaser).not.toMatch(/[#*[\]!]/);
    expect(teaser!.length).toBeLessThanOrEqual(163);
    expect(teaser!.endsWith("…")).toBe(true);
    expect(teaser!.slice(0, -1).endsWith("boundary")).toBe(true);
  });

  it("returns undefined for empty content", () => {
    expect(buildPostSpotlightTeaser({ bodyHtml: "   " })).toBeUndefined();
    expect(truncatePlainTextTeaser("")).toBeUndefined();
  });
});
