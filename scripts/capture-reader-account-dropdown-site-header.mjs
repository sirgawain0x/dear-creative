/**
 * Site header (real layout) reader account dropdown — menu open + signed-out.
 * Requires dev/start with READER_WALLET_ENABLED=true and READER_WALLET_E2E_AUTH=true.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ??
  "/opt/cursor/artifacts/screenshots/reader-account-dropdown-site-header";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const E2E_KEY = "dear_creative_reader_wallet_e2e";

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

async function mockWallet(page, { isAdmin = false } = {}) {
  await page.route("**/api/wallet/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(walletMe),
    }),
  );
  await page.route("**/api/wallet/history", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: true, transfers: [] }),
    }),
  );
  await page.route("**/api/admin/me", (route) =>
    route.fulfill({
      status: isAdmin ? 200 : 403,
      contentType: "application/json",
      body: JSON.stringify(isAdmin ? { isAdmin: true } : {}),
    }),
  );
}

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();

const signedOutShots = [
  { label: "header-390", width: 390 },
  { label: "header-840", width: 840 },
  { label: "signed-out-desktop", width: 1280 },
];

for (const shot of signedOutShots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, E2E_KEY);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const trigger =
    shot.width >= 1024
      ? page.getByTestId("reader-wallet-header-button")
      : page.getByTestId("reader-wallet-header-button-mobile");
  await trigger.waitFor({ state: "visible", timeout: 20_000 });
  await page.screenshot({
    path: path.join(assetDir, `${shot.label}.png`),
    fullPage: false,
  });
  await page.close();
}

const openMenuShots = [
  { label: "menu-open-390", width: 390, mobile: true },
  { label: "menu-open-840", width: 840, mobile: true },
  { label: "menu-open-desktop", width: 1280, mobile: false },
];

for (const shot of openMenuShots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "1");
  }, E2E_KEY);
  await mockWallet(page);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const trigger = shot.mobile
    ? page.getByTestId("reader-wallet-header-button-mobile")
    : page.getByTestId("reader-wallet-header-button");
  await trigger.waitFor({ state: "visible", timeout: 20_000 });
  await trigger.click();
  if (shot.mobile) {
    await page.getByTestId("reader-account-sheet").waitFor({ state: "visible" });
  } else {
    await page.getByTestId("reader-account-dropdown").waitFor({ state: "visible" });
  }
  if (!shot.mobile) {
    await page
      .getByTestId("reader-account-menu-actions")
      .waitFor({ state: "visible" });
    await page.getByTestId("reader-account-copy-address").waitFor({ state: "visible" });
    await page.getByTestId("reader-account-sign-out").waitFor({ state: "visible" });
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(assetDir, `${shot.label}.png`),
    fullPage: false,
  });
  await page.close();
}

// Desktop dropdown with Admin Console (admin session)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "1");
  }, E2E_KEY);
  await mockWallet(page, { isAdmin: true });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const trigger = page.getByTestId("reader-wallet-header-button");
  await trigger.waitFor({ state: "visible", timeout: 20_000 });
  await trigger.click();
  await page.getByTestId("reader-account-dropdown").waitFor({ state: "visible" });
  await page.getByTestId("reader-account-admin-console").waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(assetDir, "menu-open-desktop-admin.png"),
    fullPage: false,
  });
  await page.close();
}

// After tap: copy address closes menu (mobile proof screenshot)
{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "1");
  }, E2E_KEY);
  await mockWallet(page);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByTestId("reader-wallet-header-button-mobile").click();
  await page.getByTestId("reader-account-copy-address").click();
  await page.getByTestId("reader-account-sheet").waitFor({ state: "hidden" });
  await page.screenshot({
    path: path.join(assetDir, "menu-closed-after-copy-390.png"),
    fullPage: false,
  });
  await page.close();
}

await browser.close();
console.log("Saved site header account dropdown screenshots to", assetDir);
