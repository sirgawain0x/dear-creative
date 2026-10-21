/**
 * Capture Earn actions fixture screenshots (confirm / pending / success).
 * Usage: PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-admin-earn-actions-screenshots.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/admin-earn-actions-fixture";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const shots = [
  {
    key: "confirm390",
    name: "admin-earn-actions-confirm-mobile-390.png",
    width: 390,
    path: "/admin/earn-actions-fixture?state=confirm",
    selector: '[data-testid="earn-actions-confirm"]',
  },
  {
    key: "confirm1440",
    name: "admin-earn-actions-confirm-desktop-1440.png",
    width: 1440,
    path: "/admin/earn-actions-fixture?state=confirm",
    selector: '[data-testid="earn-actions-confirm"]',
  },
  {
    key: "pending390",
    name: "admin-earn-actions-pending-mobile-390.png",
    width: 390,
    path: "/admin/earn-actions-fixture?state=pending",
    selector: '[data-testid="earn-actions-pending"]',
  },
  {
    key: "success1440",
    name: "admin-earn-actions-success-desktop-1440.png",
    width: 1440,
    path: "/admin/earn-actions-fixture?state=success",
    selector: '[data-testid="earn-actions-success"]',
  },
];

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();
const measurements = {};

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(shot.selector, { timeout: 15_000 });
  await page.waitForTimeout(400);
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
console.log(`Saved screenshots to ${assetDir}`);
