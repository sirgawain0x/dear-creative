import { HOME_SUBSCRIBE_SECTION_ID } from "@/components/home/home-subscribe-cta";

/** Scrolls #subscribe using its CSS scroll-margin-top (see globals.css). */
export function scrollHomeSubscribeIntoView(
  behavior: ScrollBehavior = "smooth",
): void {
  const target = document.getElementById(HOME_SUBSCRIBE_SECTION_ID);
  if (!target) {
    return;
  }

  const marginTop =
    Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const docTop = target.getBoundingClientRect().top + window.scrollY;
  const desiredTop = Math.max(0, docTop - marginTop);
  const maxTop = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );

  window.scrollTo({ top: Math.min(desiredTop, maxTop), behavior });
}
