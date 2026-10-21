/**
 * Capture /admin/earn-fixture PR screenshots (fixture page, no live Privy).
 * Usage: PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-admin-earn-screenshots.mjs
 * Requires dev server with WALLET_READ_FIXTURE=true at http://127.0.0.1:3000
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/admin-earn-fixture";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const shots = [
  {
    key: "earn390",
    name: "admin-earn-mobile-390.png",
    width: 390,
  },
  {
    key: "earn1440",
    name: "admin-earn-desktop-1440.png",
    width: 1440,
  },
];

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();
const measurements = {};

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.goto(`${baseUrl}/admin/earn-fixture`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('[data-testid="admin-earn-panel"]', {
    timeout: 15_000,
  });
  await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    noHorizontalOverflow:
      document.documentElement.scrollWidth <= window.innerWidth,
  }));
  measurements[shot.key] = metrics;
  await page.screenshot({
    path: path.join(assetDir, shot.name),
    fullPage: true,
  });
  await page.close();
}

await writeFile(
  path.join(assetDir, "measurements.json"),
  `${JSON.stringify(measurements, null, 2)}\n`,
);
await browser.close();
console.log(`Saved screenshots and measurements to ${assetDir}`);
