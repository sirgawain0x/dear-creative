import { expect, test } from "@playwright/test";

test.describe("admin wallet swap fixture screenshots", () => {
  test.skip(
    Boolean(process.env.CI) && process.env.CAPTURE_WALLET_SWAP_SCREENSHOTS !== "true",
    "Manual screenshot capture (assets committed under docs/pr-assets/)",
  );

  test.setTimeout(120_000);

  test("capture swap confirm, pending, and success at 390px and 1440px", async ({
    page,
  }) => {
    const prNumber = process.env.PR_ASSETS_NUMBER ?? "93";
    const outDir = `docs/pr-assets/${prNumber}`;

    for (const { width, height, name, path } of [
      {
        width: 390,
        height: 844,
        name: "admin-wallet-swap-confirm-mobile-390.png",
        path: "/admin/wallet-fixture/swap-confirm",
      },
      {
        width: 1440,
        height: 900,
        name: "admin-wallet-swap-confirm-desktop-1440.png",
        path: "/admin/wallet-fixture/swap-confirm",
      },
      {
        width: 390,
        height: 844,
        name: "admin-wallet-swap-pending-mobile-390.png",
        path: "/admin/wallet-fixture/swap-pending",
      },
      {
        width: 1440,
        height: 900,
        name: "admin-wallet-swap-pending-desktop-1440.png",
        path: "/admin/wallet-fixture/swap-pending",
      },
      {
        width: 390,
        height: 844,
        name: "admin-wallet-swap-success-mobile-390.png",
        path: "/admin/wallet-fixture/swap-success",
      },
      {
        width: 1440,
        height: 900,
        name: "admin-wallet-swap-success-desktop-1440.png",
        path: "/admin/wallet-fixture/swap-success",
      },
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(path, { waitUntil: "networkidle" });
      await page
        .getByTestId("wallet-swap-confirm")
        .or(page.getByTestId("wallet-swap-pending"))
        .or(page.getByTestId("wallet-swap-success"))
        .waitFor();
      await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(overflow).toBe(true);
    }
  });
});
