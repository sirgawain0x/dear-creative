import { describe, expect, it, vi } from "vitest";
import {
  buildPostShareMenuItems,
  formatShareText,
  isShareAbortError,
  shouldUseNativeWebShare,
  triggerPostShare,
  wrapMenuFocusIndex,
} from "./post-share-urls";

const SPECIAL_TITLE = 'Creators & "Web3" — 100% onchain';
const SPECIAL_URL =
  "https://news.creativeplatform.xyz/posts/hello?ref=share&tag=a+b";

function mobileShareEnv(overrides: {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
} = {}) {
  return {
    share: overrides.share ?? vi.fn().mockResolvedValue(undefined),
    canShare: overrides.canShare ?? vi.fn().mockReturnValue(true),
    matchMedia: (query: string) => ({
      matches: query === "(pointer: coarse)",
    }),
  };
}

describe("formatShareText", () => {
  it("joins title and url with a space", () => {
    expect(formatShareText("Hello", "https://example.com/p")).toBe(
      "Hello https://example.com/p",
    );
  });
});

describe("wrapMenuFocusIndex", () => {
  it("wraps indices so one menu item stays focusable", () => {
    expect(wrapMenuFocusIndex(0, 11)).toBe(0);
    expect(wrapMenuFocusIndex(10, 11)).toBe(10);
    expect(wrapMenuFocusIndex(11, 11)).toBe(0);
    expect(wrapMenuFocusIndex(-1, 11)).toBe(10);
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
      href: `https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}`,
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

  it("does not duplicate the URL in the X intent text param", () => {
    const xItem = items.find((item) => item.id === "x");
    expect(xItem?.kind).toBe("link");
    if (xItem?.kind !== "link") return;
    const params = new URL(xItem.href).searchParams;
    expect(params.get("text")).toBe(SPECIAL_TITLE);
    expect(params.get("url")).toBe(SPECIAL_URL);
    expect(params.get("text")).not.toContain(SPECIAL_URL);
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

describe("shouldUseNativeWebShare", () => {
  const data = { title: "Title", url: "https://example.com/post" };

  it("requires coarse pointer and canShare", () => {
    expect(
      shouldUseNativeWebShare(data, mobileShareEnv()),
    ).toBe(true);
    expect(
      shouldUseNativeWebShare(data, {
        share: vi.fn(),
        canShare: vi.fn().mockReturnValue(true),
        matchMedia: () => ({ matches: false }),
      }),
    ).toBe(false);
    expect(
      shouldUseNativeWebShare(data, {
        share: vi.fn(),
        canShare: vi.fn().mockReturnValue(false),
        matchMedia: (query) => ({ matches: query === "(pointer: coarse)" }),
      }),
    ).toBe(false);
  });
});

describe("triggerPostShare", () => {
  const payload = {
    title: "Title",
    url: "https://example.com/post",
    onFallback: vi.fn(),
  };

  it("calls navigator.share on coarse pointer when canShare passes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const onFallback = vi.fn();
    const env = mobileShareEnv({ share });

    const result = await triggerPostShare({ ...payload, onFallback }, env);

    expect(result).toBe("native");
    expect(share).toHaveBeenCalledWith({
      title: "Title",
      url: "https://example.com/post",
    });
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("opens fallback menu on desktop (fine pointer) even when share exists", async () => {
    const onFallback = vi.fn();
    const result = await triggerPostShare(
      { ...payload, onFallback },
      {
        share: vi.fn(),
        canShare: vi.fn().mockReturnValue(true),
        matchMedia: () => ({ matches: false }),
      },
    );

    expect(result).toBe("fallback");
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("opens fallback menu when navigator.share is missing", async () => {
    const onFallback = vi.fn();

    const result = await triggerPostShare(
      { ...payload, onFallback },
      {},
    );

    expect(result).toBe("fallback");
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("does not open fallback when the user cancels native share (AbortError)", async () => {
    const onFallback = vi.fn();
    const abort = new DOMException("Share canceled", "AbortError");
    const env = mobileShareEnv({
      share: vi.fn().mockRejectedValue(abort),
    });

    const result = await triggerPostShare({ ...payload, onFallback }, env);

    expect(result).toBe("cancelled");
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("opens fallback on non-abort share errors", async () => {
    const onFallback = vi.fn();
    const env = mobileShareEnv({
      share: vi.fn().mockRejectedValue(new Error("Share failed")),
    });

    const result = await triggerPostShare({ ...payload, onFallback }, env);

    expect(result).toBe("fallback");
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
});

describe("isShareAbortError", () => {
  it("detects AbortError from the Web Share API", () => {
    expect(isShareAbortError(new DOMException("nope", "AbortError"))).toBe(
      true,
    );
    expect(isShareAbortError(new Error("AbortError"))).toBe(false);
  });
});
