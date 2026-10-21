import { afterEach, describe, expect, it, vi } from "vitest";
import { setPaywallEnabledForTests } from "./feature-flag";
import {
  readerGatedPostAudioApiPath,
  resolveReaderFacingAudioUrl,
} from "./reader-gated-audio-url";
import {
  applyReaderBodyToPost,
  type PublishedPostWithPaywallFields,
} from "./reader-post";

const STORAGE_URL = "https://cdn.example/gated-narration.mp3";

describe("resolveReaderFacingAudioUrl", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("returns the gated audio API route for gated posts when paywall is on", () => {
    setPaywallEnabledForTests(true);
    expect(
      resolveReaderFacingAudioUrl({
        slug: "paid-post",
        isGated: true,
        storedAudioUrl: STORAGE_URL,
      }),
    ).toBe(readerGatedPostAudioApiPath("paid-post"));
  });

  it("returns stored URL when paywall is off", () => {
    setPaywallEnabledForTests(false);
    expect(
      resolveReaderFacingAudioUrl({
        slug: "paid-post",
        isGated: true,
        storedAudioUrl: STORAGE_URL,
      }),
    ).toBe(STORAGE_URL);
  });

  it("applyReaderBodyToPost never exposes raw storage for gated paywalled posts", () => {
    setPaywallEnabledForTests(true);
    const row: PublishedPostWithPaywallFields = {
      slug: "paid-post",
      title: "Paid",
      publishedAt: "2026-01-01T00:00:00.000Z",
      canonicalUrl: null,
      excerpt: "Teaser",
      teaser: "Teaser",
      coverImage: "/images/default.png",
      readMinutes: 1,
      listenMinutes: 1,
      readingTimeLabel: "1 min read",
      topic: "ai-ownership",
      bodyHtml: "<p>Free</p>",
      audioUrl: STORAGE_URL,
      audioVoice: "Puck",
      author: null,
      postId: "post-1",
      authorId: "writer-1",
      isGated: true,
      freeContent: "Free",
      gatedContent: "Secret",
    };
    const post = applyReaderBodyToPost(row, true);
    expect(post.audioUrl).toBe("/api/posts/paid-post/audio");
    expect(JSON.stringify(post)).not.toContain("cdn.example");
  });
});
