import { describe, expect, it, vi } from "vitest";
import {
  handleDispatchAudioDocumentClick,
  shouldStopDispatchAudioForLinkClick,
} from "./dispatch-audio-player-navigation";

describe("shouldStopDispatchAudioForLinkClick", () => {
  const current = "https://dear.example/posts/slug-a";

  it("stops for same-origin path change", () => {
    expect(
      shouldStopDispatchAudioForLinkClick(
        {
          href: "https://dear.example/posts/slug-b",
          target: "",
          hasAttribute: () => false,
        },
        current,
      ),
    ).toBe(true);
  });

  it("ignores same path, external links, downloads, and new tabs", () => {
    expect(
      shouldStopDispatchAudioForLinkClick(
        {
          href: "https://dear.example/posts/slug-a#section",
          target: "",
          hasAttribute: () => false,
        },
        current,
      ),
    ).toBe(false);
    expect(
      shouldStopDispatchAudioForLinkClick(
        {
          href: "https://other.example/posts/x",
          target: "",
          hasAttribute: () => false,
        },
        current,
      ),
    ).toBe(false);
    expect(
      shouldStopDispatchAudioForLinkClick(
        {
          href: "https://dear.example/file.mp3",
          target: "",
          hasAttribute: (n) => n === "download",
        },
        current,
      ),
    ).toBe(false);
    expect(
      shouldStopDispatchAudioForLinkClick(
        {
          href: "https://dear.example/posts/b",
          target: "_blank",
          hasAttribute: () => false,
        },
        current,
      ),
    ).toBe(false);
  });
});

describe("handleDispatchAudioDocumentClick", () => {
  it("invokes onLeave for in-app anchor navigation", () => {
    const onLeave = vi.fn();
    const anchor = {
      href: "https://dear.example/about",
      target: "",
      hasAttribute: () => false,
      closest: () => null,
    };
    handleDispatchAudioDocumentClick(
      {
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: {
          closest: () => anchor,
        } as unknown as EventTarget,
      },
      "https://dear.example/posts/live",
      onLeave,
    );
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("ignores modified clicks", () => {
    const onLeave = vi.fn();
    handleDispatchAudioDocumentClick(
      {
        defaultPrevented: false,
        button: 0,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: {
          closest: () => ({
            href: "https://dear.example/x",
            target: "",
            hasAttribute: () => false,
          }),
        } as unknown as EventTarget,
      },
      "https://dear.example/posts/live",
      onLeave,
    );
    expect(onLeave).not.toHaveBeenCalled();
  });
});
