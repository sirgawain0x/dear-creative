import { describe, expect, it } from "vitest";
import {
  spotlightCoverDisplaySrc,
  spotlightCoverFallbackDataUrl,
} from "./post-spotlight-cover-fallback";

describe("spotlightCoverFallbackDataUrl", () => {
  it("returns a deterministic SVG data URL from slug and title", () => {
    const url = spotlightCoverFallbackDataUrl({
      slug: "fixture-spotlight-grove-cover",
      title: "Grove Cover Image",
    });
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Grove Cover Image");
  });
});

describe("spotlightCoverDisplaySrc", () => {
  const fallback = "data:image/svg+xml;utf8,fallback";

  it("uses requested src until load fails", () => {
    expect(
      spotlightCoverDisplaySrc({
        requestedSrc: "https://api.grove.storage/abc",
        loadFailed: false,
        fallbackSrc: fallback,
      }),
    ).toBe("https://api.grove.storage/abc");
  });

  it("switches to SVG fallback after onError", () => {
    expect(
      spotlightCoverDisplaySrc({
        requestedSrc: "https://api.grove.storage/broken",
        loadFailed: true,
        fallbackSrc: fallback,
      }),
    ).toBe(fallback);
  });
});
