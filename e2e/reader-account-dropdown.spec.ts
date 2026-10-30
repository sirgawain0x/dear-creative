import { test, expect } from "@playwright/test";
const SITE_HEADER_FIXTURE = "/reader/site-header-fixture";

test.describe("Reader account dropdown on site header", () => {
  test("signed-out mobile: Sign In lives in the hamburger menu, not the top bar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Issue #121: the wallet Sign In button no longer sits in the mobile top bar.
    await expect(
      page.getByTestId("reader-wallet-header-button-mobile"),
    ).toHaveCount(0);
    // Sign In is inside the hamburger menu instead.
    await page
      .getByRole("button", { name: "Toggle navigation menu" })
      .click();
    const mobileNav = page.getByRole("navigation", {
      name: "Mobile navigation",
    });
    await expect(mobileNav.getByText("Sign In", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("mobile sheet opens above page content and closes after Copy address", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(SITE_HEADER_FIXTURE, { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("button", { name: "Open account menu" });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();

    const overlay = page.getByTestId("reader-account-sheet-overlay");
    const sheet = page.getByTestId("reader-account-sheet");
    await expect(overlay).toBeVisible();
    await expect(sheet).toBeVisible();

    const metrics = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="reader-account-sheet-overlay"]',
      );
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        innerHeight: window.innerHeight,
        parentTag: el.parentElement?.tagName ?? null,
      };
    });
    expect(metrics?.parentTag).toBe("BODY");
    expect(metrics!.height).toBeGreaterThanOrEqual(metrics!.innerHeight * 0.9);

    await page.getByTestId("reader-account-copy-address").click();
    await expect(sheet).toBeHidden({ timeout: 5000 });
  });

  test("desktop dropdown opens and closes after Copy address", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(SITE_HEADER_FIXTURE, { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("button", { name: "Open account menu" });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();

    const menu = page.getByTestId("reader-account-dropdown");
    await expect(menu).toBeVisible();

    const menuOutsideHeader = await page.evaluate(() => {
      const menuEl = document.querySelector(
        '[data-testid="reader-account-dropdown"]',
      );
      return menuEl ? menuEl.closest("header") === null : false;
    });
    expect(menuOutsideHeader).toBe(true);

    await page.getByTestId("reader-account-copy-address").click();
    await expect(menu).toBeHidden({ timeout: 5000 });
  });
});
