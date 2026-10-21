import { expect, test } from "@playwright/test";

test.describe("admin wallet send fixture screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      process.env = { ...process.env, WALLET_READ_FIXTURE: "true" };
    });
  });

  async function openSendForm(page: import("@playwright/test").Page) {
    await page.getByTestId("admin-wallet-send-open").click();
    await page.getByPlaceholder("0x… checksummed").fill(
      "0x2222222222222222222222222222222222222222",
    );
    await page.locator('input[inputmode="decimal"]').fill("10.5");
  }

  test("capture send form and confirm at 390px and 1440px", async ({ page }) => {
    const prNumber = process.env.PR_ASSETS_NUMBER ?? "draft";
    const outDir = `docs/pr-assets/${prNumber}`;

    for (const { width, name } of [
      { width: 390, name: "admin-wallet-send-form-mobile-390.png" },
      { width: 1440, name: "admin-wallet-send-form-desktop-1440.png" },
    ] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto("/admin/wallet-fixture");
      await openSendForm(page);
      await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(overflow).toBe(true);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await openSendForm(page);
    await page.getByRole("button", { name: /review send/i }).click();
    await page.getByRole("button", { name: /confirm send/i }).waitFor();
    await page.screenshot({
      path: `${outDir}/admin-wallet-send-confirm-mobile-390.png`,
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/wallet-fixture");
    await page.getByTestId("admin-wallet-send-open").click();
    await page.getByPlaceholder("0x… checksummed").fill(
      "0x2222222222222222222222222222222222222222",
    );
    await page.locator('input[inputmode="decimal"]').fill("10.5");
    await page.getByRole("button", { name: /review send/i }).click();
    await page.getByRole("button", { name: /confirm send/i }).waitFor();
    await page.screenshot({
      path: `${outDir}/admin-wallet-send-confirm-desktop-1440.png`,
      fullPage: true,
    });
  });
});
