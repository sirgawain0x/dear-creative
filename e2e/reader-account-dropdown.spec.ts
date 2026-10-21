import { test, expect } from "@playwright/test";
import {
  READER_WALLET_E2E_STORAGE_KEY,
} from "../src/lib/wallet/reader-wallet-e2e-auth";

const walletMe = {
  configured: true,
  address: "0x1234567890abcdef1234567890abcdef12345678",
  network: "base",
  chainId: 8453,
  balances: {
    eth: { formatted: "0.01" },
    usdc: { formatted: "12.34" },
  },
};

async function mockReaderWalletApis(page: import("@playwright/test").Page) {
  await page.route("**/api/wallet/me", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(walletMe),
    }),
  );
  await page.route("**/api/wallet/history", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: true, transfers: [] }),
    }),
  );
  await page.route("**/api/admin/me", async (route) =>
    route.fulfill({ status: 403, body: "{}" }),
  );
}

async function enableE2eSignedIn(page: import("@playwright/test").Page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "1");
  }, READER_WALLET_E2E_STORAGE_KEY);
}

test.describe("Reader account dropdown on site header", () => {
  test("signed-out shows Sign In on wallet control", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((key) => {
      window.localStorage.removeItem(key);
    }, READER_WALLET_E2E_STORAGE_KEY);
    await page.goto("/", { waitUntil: "networkidle" });
    const mobileBtn = page.getByTestId("reader-wallet-header-button-mobile");
    await expect(mobileBtn).toBeVisible({ timeout: 15_000 });
    await expect(mobileBtn).toHaveText(/Sign In/i);
  });

  test("mobile sheet opens above page content and closes after Copy address", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enableE2eSignedIn(page);
    await mockReaderWalletApis(page);
    await page.goto("/", { waitUntil: "networkidle" });

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
    await enableE2eSignedIn(page);
    await mockReaderWalletApis(page);
    await page.goto("/", { waitUntil: "networkidle" });

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
