/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { HOME_SUBSCRIBE_SECTION_ID } from "./home-subscribe-cta";
import { scrollHomeSubscribeIntoView } from "./scroll-home-subscribe-into-view";

describe("scrollHomeSubscribeIntoView", () => {
  it("scrolls using scroll-margin-top from computed styles", () => {
    const section = document.createElement("section");
    section.id = HOME_SUBSCRIBE_SECTION_ID;
    section.getBoundingClientRect = () =>
      ({
        top: 200,
        bottom: 400,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(section);

    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 3000,
      configurable: true,
    });

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      scrollMarginTop: "64px",
    } as CSSStyleDeclaration);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    scrollHomeSubscribeIntoView("instant");

    expect(scrollTo).toHaveBeenCalledWith({ top: 236, behavior: "instant" });
    section.remove();
  });
});
