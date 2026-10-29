import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

const OUT_DIR = join(process.cwd(), "docs/pr-assets/creative-platform-ui");

async function openCreativePlatformDrawer(page: import("@playwright/test").Page) {
  const trigger = page.locator("#creative-platform-apps-btn");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  await expect(page.getByTestId("creative-platform-apps-sheet")).toBeVisible({
    timeout: 10_000,
  });
}

async function applyTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((mode) => {
    window.localStorage.setItem("theme", mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, theme);
}

test.describe("Creative Platform UI screenshots", () => {
  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
  });

  test("drawer open at mobile and desktop widths", async ({ page }) => {
    await page.goto("/reader/post-theme-fixture", { waitUntil: "domcontentloaded" });

    await page.setViewportSize({ width: 375, height: 812 });
    await openCreativePlatformDrawer(page);
    await expect(page.getByTestId("creative-platform-current-badge")).toHaveText(/current/i);
    await page.screenshot({
      path: join(OUT_DIR, "creative-platform-drawer-375.png"),
      fullPage: true,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("creative-platform-apps-sheet")).toBeHidden({
      timeout: 5000,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await openCreativePlatformDrawer(page);
    await page.screenshot({
      path: join(OUT_DIR, "creative-platform-drawer-1440.png"),
      fullPage: true,
    });
  });

  for (const theme of ["light", "dark"] as const) {
    test(`post theme fixture — ${theme}`, async ({ page }) => {
      await page.goto("/reader/post-theme-fixture", { waitUntil: "domcontentloaded" });
      await applyTheme(page, theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("post-theme-fixture")).toBeVisible({ timeout: 15_000 });

      await page.setViewportSize({ width: 375, height: 900 });
      await page.screenshot({
        path: join(OUT_DIR, `post-page-${theme}-375.png`),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({
        path: join(OUT_DIR, `post-page-${theme}-1440.png`),
        fullPage: true,
      });
    });
  }
});
