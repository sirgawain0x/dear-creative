import { describe, expect, it } from "vitest";
import type { AdminPostRecord } from "@/lib/posts/manage-posts";
import { previewPostBodyHtml } from "./preview-post-body";

const GATED_SECRET = "FULL_GATED_PREVIEW_SECRET";

describe("previewPostBodyHtml", () => {
  it("includes gated content for paid posts", () => {
    const post = {
      id: "p1",
      slug: "gated-draft",
      title: "Gated",
      status: "draft",
      publishedAt: null,
      teaserText: null,
      emailSubject: null,
      emailHtml: null,
      bodyHtml: "<p>free</p>",
      markdown: "",
      isGated: true,
      freeContent: "<p>free</p>",
      gatedContent: `<p>${GATED_SECRET}</p>`,
      gatePriceUsdc: 1,
      canonicalUrl: null,
      source: null,
      sponsorId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies AdminPostRecord;

    const html = previewPostBodyHtml(post);
    expect(html).toContain(GATED_SECRET);
  });
});
