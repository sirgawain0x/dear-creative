import { expect, test } from "@playwright/test";

test.describe("admin wallet send fixture screenshots", () => {
  test.setTimeout(120_000);

  test("capture send form and confirm at 390px and 1440px", async ({ page }) => {
    const prNumber = process.env.PR_ASSETS_NUMBER ?? "draft";
    const outDir = `docs/pr-assets/${prNumber}`;

    for (const { width, height, name, path } of [
      {
        width: 390,
        height: 844,
        name: "admin-wallet-send-form-mobile-390.png",
        path: "/admin/wallet-fixture/send-form",
      },
      {
        width: 1440,
        height: 900,
        name: "admin-wallet-send-form-desktop-1440.png",
        path: "/admin/wallet-fixture/send-form",
      },
      {
        width: 390,
        height: 844,
        name: "admin-wallet-send-confirm-mobile-390.png",
        path: "/admin/wallet-fixture/send-confirm",
      },
      {
        width: 1440,
        height: 900,
        name: "admin-wallet-send-confirm-desktop-1440.png",
        path: "/admin/wallet-fixture/send-confirm",
      },
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(path, { waitUntil: "networkidle" });
      await page.getByTestId("admin-wallet-send-form").or(
        page.getByTestId("admin-wallet-send-confirm"),
      ).waitFor();
      await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(overflow).toBe(true);
    }
  });
});
