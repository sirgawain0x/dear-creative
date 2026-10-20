import { describe, expect, it } from "vitest";
import {
  extractFirstAllowlistedImageFromHtml,
  extractFirstImageFromHtml,
  generateDeterministicBannerSvg,
  resolvePostCoverImage,
  resolvePublicPostCoverImage,
} from "./post-cover-image";

const PAPYRUS_COVER =
  "https://storage.googleapis.com/papyrus_images/1561f2d41303599b84b0b17bec1b224df57d01b39a51109b25adec70bfe7896c.png";

describe("post-cover-image", () => {
  it("extracts <img> tags from HTML", () => {
    const html =
      '<p>Hello</p><img src="https://api.grove.storage/abc123" alt="Banner" /><p>World</p>';
    expect(extractFirstImageFromHtml(html)).toBe(
      "https://api.grove.storage/abc123",
    );
  });

  it("extracts Markdown image syntax", () => {
    const md =
      "## Introduction\n\n![Cover](https://api.grove.storage/xyz789)\n\nSome body text.";
    expect(extractFirstImageFromHtml(md)).toBe(
      "https://api.grove.storage/xyz789",
    );
  });

  it("generates deterministic SVG banner for a post", () => {
    const svg = generateDeterministicBannerSvg({
      title: "Decentralized Publishing",
      slug: "decentralized-publishing",
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("DEAR CREATIVE");
    expect(svg).toContain("Decentralized Publishing");
  });

  it("falls back to SVG when cover host is not allowlisted", () => {
    const url = resolvePostCoverImage({
      title: "Custom",
      slug: "custom",
      coverImage: "https://example.com/banner.png",
    });
    expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
  });

  it("keeps Grove storage URLs but they bypass the optimizer at render time", () => {
    const url = resolvePostCoverImage({
      title: "Grove",
      slug: "grove-post",
      coverImage: "https://api.grove.storage/abc123",
    });
    expect(url).toBe("https://api.grove.storage/abc123");
  });

  it("resolvePublicPostCoverImage prefers explicit coverImage", () => {
    const url = resolvePublicPostCoverImage({
      title: "Explicit cover",
      slug: "explicit-cover",
      coverImage: PAPYRUS_COVER,
      bodyHtml: `<img src="/images/hello-dear-creative-banner.jpg" alt="body" />`,
    });
    expect(url).toBe(PAPYRUS_COVER);
  });

  it("resolvePublicPostCoverImage uses first allowlisted image in bodyHtml", () => {
    const url = resolvePublicPostCoverImage({
      title: "Paid body art",
      slug: "paid-body-art",
      bodyHtml: `<p>Lead</p><img src="https://example.com/blocked.png" /><img src="${PAPYRUS_COVER}" alt="Hero" />`,
    });
    expect(url).toBe(PAPYRUS_COVER);
  });

  it("extractFirstAllowlistedImageFromHtml skips blocked hosts", () => {
    expect(
      extractFirstAllowlistedImageFromHtml(
        `<img src="https://example.com/x.png" /><img src="${PAPYRUS_COVER}" />`,
      ),
    ).toBe(PAPYRUS_COVER);
  });

  it("resolves hello-dear-creative to the local asset", () => {
    const url = resolvePostCoverImage({
      title: "Hello, Dear Creative",
      slug: "hello-dear-creative",
    });
    expect(url).toBe("/images/hello-dear-creative-banner.jpg");
  });

  it("falls back to deterministic data URL when no allowlisted image is present", () => {
    const url = resolvePublicPostCoverImage({
      title: "Text Only",
      slug: "text-only",
      bodyHtml: "<p>Just text without any images.</p>",
    });
    expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
  });
});
