/**
 * Capture /reader/wallet-fixture screenshots (mocked address, no secrets).
 * Usage: PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-reader-wallet-screenshots.mjs
 * Requires `npm run dev` at http://127.0.0.1:3000 (/reader/wallet-fixture is dev-only)
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/reader-wallet";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const shots = [
  {
    name: "reader-wallet-receive-mobile-390.png",
    width: 390,
  },
  {
    name: "reader-wallet-receive-desktop-1440.png",
    width: 1440,
  },
];

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.goto(`${baseUrl}/reader/wallet-fixture`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("reader-wallet-panel").waitFor({ state: "visible" });
  await page.getByTestId("reader-wallet-receive-qr").waitFor({
    state: "visible",
  });
  await page.screenshot({
    path: path.join(assetDir, shot.name),
    fullPage: true,
  });
  await page.close();
}

await browser.close();
console.log(`Saved reader wallet screenshots to ${assetDir}`);
