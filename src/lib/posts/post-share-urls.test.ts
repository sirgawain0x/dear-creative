import { describe, expect, it, vi } from "vitest";
import {
  buildPostShareMenuItems,
  formatShareText,
  isNativeShareAvailable,
  triggerPostShare,
} from "./post-share-urls";

const SPECIAL_TITLE = 'Creators & "Web3" — 100% onchain';
const SPECIAL_URL =
  "https://news.creativeplatform.xyz/posts/hello?ref=share&tag=a+b";

describe("formatShareText", () => {
  it("joins title and url with a space", () => {
    expect(formatShareText("Hello", "https://example.com/p")).toBe(
      "Hello https://example.com/p",
    );
  });
});

describe("buildPostShareMenuItems", () => {
  const items = buildPostShareMenuItems({
    title: SPECIAL_TITLE,
    url: SPECIAL_URL,
  });

  it("includes every network with encodeURIComponent-safe hrefs", () => {
    const shareText = formatShareText(SPECIAL_TITLE, SPECIAL_URL);
    const encodedUrl = encodeURIComponent(SPECIAL_URL);
    const encodedTitle = encodeURIComponent(SPECIAL_TITLE);
    const encodedText = encodeURIComponent(shareText);
    const encodedBody = encodeURIComponent(`${SPECIAL_TITLE}\n\n${SPECIAL_URL}`);

    const byId = Object.fromEntries(items.map((item) => [item.id, item]));

    expect(byId.x).toMatchObject({
      kind: "link",
      href: `https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}`,
    });
    expect(byId.linkedin).toMatchObject({
      kind: "link",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    });
    expect(byId.facebook).toMatchObject({
      kind: "link",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    });
    expect(byId.farcaster).toMatchObject({
      kind: "link",
      href: `https://farcaster.xyz/~/compose?text=${encodedText}&embeds[]=${encodedUrl}`,
    });
    expect(byId.lens).toMatchObject({
      kind: "link",
      href: `https://hey.xyz/?text=${encodedText}`,
    });
    expect(byId.bluesky).toMatchObject({
      kind: "link",
      href: `https://bsky.app/intent/compose?text=${encodedText}`,
    });
    expect(byId.threads).toMatchObject({
      kind: "link",
      href: `https://www.threads.net/intent/post?text=${encodedText}`,
    });
    expect(byId.whatsapp).toMatchObject({
      kind: "link",
      href: `https://wa.me/?text=${encodedText}`,
    });
    expect(byId.reddit).toMatchObject({
      kind: "link",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    });
    expect(byId.email).toMatchObject({
      kind: "link",
      href: `mailto:?subject=${encodedTitle}&body=${encodedBody}`,
    });
    expect(byId.copy).toMatchObject({
      kind: "copy",
      url: SPECIAL_URL,
    });
  });

  it("does not leave raw ampersands or spaces in query values", () => {
    for (const item of items) {
      if (item.kind !== "link") continue;
      expect(item.href).not.toMatch(/[?&][^=]+=[^&]* /);
      expect(item.href).not.toContain(`${SPECIAL_URL}`);
      expect(item.href).not.toContain(`${SPECIAL_TITLE}`);
    }
  });
});

describe("triggerPostShare", () => {
  it("calls navigator.share when supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const onFallback = vi.fn();

    const result = await triggerPostShare(
      {
        title: "Title",
        url: "https://example.com/post",
        onFallback,
      },
      { share },
    );

    expect(result).toBe("native");
    expect(share).toHaveBeenCalledWith({
      title: "Title",
      url: "https://example.com/post",
    });
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("opens fallback menu when navigator.share is missing", async () => {
    const onFallback = vi.fn();

    const result = await triggerPostShare(
      {
        title: "Title",
        url: "https://example.com/post",
        onFallback,
      },
      {},
    );

    expect(result).toBe("fallback");
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
});

describe("isNativeShareAvailable", () => {
  it("reflects navigator.share presence", () => {
    expect(isNativeShareAvailable({ share: vi.fn() })).toBe(true);
    expect(isNativeShareAvailable({})).toBe(false);
    expect(isNativeShareAvailable(undefined)).toBe(false);
  });
});
