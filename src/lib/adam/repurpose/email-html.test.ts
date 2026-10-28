import { describe, expect, it } from "vitest";
import {
  sampleMindMap,
  sampleReport,
} from "@/lib/adam/repurpose/fixtures/sample-payloads";
import {
  appendRepurposeSectionsToEmailHtml,
  renderRepurposeOutputEmailSection,
} from "./email-html";

describe("renderRepurposeOutputEmailSection", () => {
  it("uses table layout and inline styles for mind map", () => {
    const html = renderRepurposeOutputEmailSection({
      output: {
        id: "1",
        postId: "p",
        outputType: "mind_map",
        status: "ready",
        payload: sampleMindMap,
        mediaUrl: null,
        mediaMimeType: null,
        errorMessage: null,
        createdAt: "",
        updatedAt: "",
      },
      postUrl: "https://example.test/posts/x",
    });
    expect(html).toContain("<table");
    expect(html).toContain("Core idea");
    expect(html).not.toContain("<script");
  });

  it("links video overview with thumbnail instead of video tag", () => {
    const html = renderRepurposeOutputEmailSection({
      output: {
        id: "1",
        postId: "p",
        outputType: "video_overview",
        status: "ready",
        payload: null,
        mediaUrl: "https://cdn.test/video.mp4",
        mediaMimeType: "video/mp4",
        errorMessage: null,
        createdAt: "",
        updatedAt: "",
      },
      postUrl: "https://example.test/posts/x",
      thumbnailUrl: "https://example.test/thumb.jpg",
    });
    expect(html).toContain("<img");
    expect(html).toContain("https://cdn.test/video.mp4");
    expect(html).not.toContain("<video");
  });
});

describe("appendRepurposeSectionsToEmailHtml", () => {
  it("appends selected report section to base html", () => {
    const html = appendRepurposeSectionsToEmailHtml({
      baseHtml: "<p>Hello</p>",
      includeTypes: ["report"],
      postUrl: "https://example.test/posts/x",
      outputs: [
        {
          id: "1",
          postId: "p",
          outputType: "report",
          status: "ready",
          payload: sampleReport,
          mediaUrl: null,
          mediaMimeType: null,
          errorMessage: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("Briefing");
  });
});
