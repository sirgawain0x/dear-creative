import { describe, expect, it } from "vitest";
import {
  sampleMindMap,
  sampleReport,
} from "@/lib/adam/repurpose/fixtures/sample-payloads";
import {
  isAbsoluteHttpsUrl,
  renderRepurposeOutputEmailSection,
} from "./email-html";

describe("isAbsoluteHttpsUrl", () => {
  it("accepts https URLs only", () => {
    expect(isAbsoluteHttpsUrl("https://cdn.example/thumb.jpg")).toBe(true);
    expect(isAbsoluteHttpsUrl("http://cdn.example/thumb.jpg")).toBe(false);
    expect(isAbsoluteHttpsUrl("/posts/x")).toBe(false);
    expect(isAbsoluteHttpsUrl("not-a-url")).toBe(false);
  });
});

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

  it("renders report section bullets as an escaped list", () => {
    const html = renderRepurposeOutputEmailSection({
      output: {
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
      postUrl: "https://example.test/posts/x",
    });
    expect(html).toContain("<ul");
    expect(html).toContain("One");
    expect(html).toContain("Body copy.");
  });

  it("uses https cover image for video overview thumbnail", () => {
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
      coverImage: "https://example.test/thumb.jpg",
    });
    expect(html).toContain("<img");
    expect(html).toContain("https://example.test/thumb.jpg");
    expect(html).not.toContain('<img src="https://example.test/posts/x"');
    expect(html).not.toContain("<video");
  });

  it("omits img when cover is not absolute https and keeps text link", () => {
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
      coverImage: "/images/banner.svg",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("Open video overview");
    expect(html).toContain("https://cdn.test/video.mp4");
  });
});
