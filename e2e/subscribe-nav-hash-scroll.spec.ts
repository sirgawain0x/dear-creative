import { test, expect } from "@playwright/test";

const MOBILE_WIDTH = 375;

const readSubscribeScrollMetrics = () => {
  const header = document.querySelector("header");
  const section = document.getElementById("subscribe");
  if (!header || !section) {
    return null;
  }
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const headerBottom = header.getBoundingClientRect().bottom;
  const scrollY = window.scrollY;
  const gap = section.getBoundingClientRect().top - headerBottom;
  const docTop = section.getBoundingClientRect().top + scrollY;
  const idealScroll = docTop - margin;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return { gap, scrollY, maxScroll, margin, docTop, idealScroll, headerBottom };
};

test.describe("Subscribe nav and hash scroll", () => {
  test("mobile drawer closes after Subscribe from /posts", async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: 812 });
    await page.goto("/posts", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Toggle navigation menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();

    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", {
      name: "Subscribe",
    }).click();

    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Toggle navigation menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await page.waitForURL(/\/#subscribe$/, { timeout: 15_000 });
  });

  test("#subscribe is not hidden under the sticky header at 375px", async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: 812 });
    await page.goto("/#subscribe", { waitUntil: "domcontentloaded" });

    const subscribe = page.locator("#subscribe");
    await expect(subscribe).toBeVisible({ timeout: 15_000 });

    const maxGapPx = 24;

    await page.waitForFunction(
      (maxGap) => {
        const header = document.querySelector("header");
        const section = document.getElementById("subscribe");
        if (!header || !section) return false;
        const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
        const headerBottom = header.getBoundingClientRect().bottom;
        const scrollY = window.scrollY;
        const gap = section.getBoundingClientRect().top - headerBottom;
        const docTop = section.getBoundingClientRect().top + scrollY;
        const idealScroll = docTop - margin;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (gap < 0) return false;
        const scrollClamped = idealScroll > maxScroll + 0.5;
        if (scrollClamped) {
          const expectedGap = docTop - maxScroll - headerBottom;
          return Math.abs(gap - expectedGap) < 2;
        }
        return gap <= maxGap;
      },
      maxGapPx,
      { timeout: 15_000 },
    );

    const metrics = await page.evaluate(readSubscribeScrollMetrics);
    expect(metrics).not.toBeNull();

    const { gap, idealScroll, maxScroll, docTop, headerBottom, margin, scrollY } = metrics!;
    expect(gap).toBeGreaterThanOrEqual(0);

    const scrollClamped = idealScroll > maxScroll + 0.5;
    if (scrollClamped) {
      const expectedGap = docTop - maxScroll - headerBottom;
      expect(Math.abs(gap - expectedGap)).toBeLessThanOrEqual(2);
      expect(margin).toBeGreaterThan(0);
      expect(scrollY).toBeGreaterThanOrEqual(maxScroll - 2);
    } else {
      expect(gap).toBeLessThanOrEqual(maxGapPx);
    }
  });
});
