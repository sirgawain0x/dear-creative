/**
 * Screenshots for reader account dropdown (390 / 840 / desktop).
 * Requires dev server with READER_WALLET_FIXTURE=true and fixture route.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ??
  "/opt/cursor/artifacts/screenshots/reader-account-dropdown";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const widths = [
  { label: "390", width: 390, height: 844 },
  { label: "840", width: 840, height: 900 },
  { label: "desktop", width: 1280, height: 800 },
];

const previewWallet = {
  configured: true,
  address: "0x1234567890abcdef1234567890abcdef12345678",
  network: "base",
  chainId: 8453,
  balances: {
    eth: { formatted: "0.01" },
    usdc: { formatted: "12.34" },
  },
};

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();

for (const vp of widths) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });

  await page.route("**/api/wallet/me", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(previewWallet),
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isAdmin: true }),
    }),
  );

  await page.goto(`${baseUrl}/reader/account-dropdown-fixture`, {
    waitUntil: "networkidle",
  });

  const trigger =
    vp.width >= 1024
      ? page.getByTestId("reader-wallet-header-button")
      : page.getByTestId("reader-wallet-header-button-mobile");

  await trigger.click();
  await page.waitForTimeout(400);

  const file = path.join(assetDir, `account-dropdown-${vp.label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

await browser.close();
