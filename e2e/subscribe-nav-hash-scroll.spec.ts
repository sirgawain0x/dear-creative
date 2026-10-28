import { test, expect } from "@playwright/test";

const MOBILE_WIDTH = 375;

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
    await page.waitForURL(/\/?(#subscribe)?$/, { timeout: 15_000 });
  });

  test("#subscribe is not hidden under the sticky header at 375px", async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: 812 });
    await page.goto("/#subscribe", { waitUntil: "domcontentloaded" });

    const subscribe = page.locator("#subscribe");
    await expect(subscribe).toBeVisible({ timeout: 15_000 });

    await page.waitForFunction(
      () => {
        const header = document.querySelector("header");
        const section = document.getElementById("subscribe");
        if (!header || !section) return false;
        const gap = section.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
        return gap >= -1;
      },
      undefined,
      { timeout: 15_000 },
    );

    const gap = await page.evaluate(() => {
      const header = document.querySelector("header");
      const section = document.getElementById("subscribe");
      if (!header || !section) return null;
      return section.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    });

    expect(gap).not.toBeNull();
    expect(gap!).toBeGreaterThanOrEqual(-1);
  });
});
