/**
 * Capture admin payouts PR screenshots (fixture API mocks, no secrets).
 * Usage:
 *   ADMIN_PAYOUTS_FIXTURE=true PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-admin-payouts-screenshots.mjs
 * Requires dev server at http://127.0.0.1:3000
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
const assetDir = process.env.PR_ASSET_DIR ?? "docs/pr-assets/89";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

/** @param {import('@playwright/test').Page} page */
async function waitForPayoutsFixture(page, expectStudioNote) {
  const testId = expectStudioNote
    ? "admin-payouts-privy-sign-in-note"
    : "admin-payouts-card";
  await page.getByTestId(testId).waitFor({ state: "attached" });
}

const shots = [
  {
    name: "admin-payouts-studio-note-mobile-390.png",
    width: 390,
    height: 844,
    path: "/admin/payouts-fixture?view=studio-key",
    expectStudioNote: true,
  },
  {
    name: "admin-payouts-studio-note-desktop-1440.png",
    width: 1440,
    height: 900,
    path: "/admin/payouts-fixture?view=studio-key",
    expectStudioNote: true,
  },
  {
    name: "admin-payouts-privy-admin-mobile-390.png",
    width: 390,
    height: 844,
    path: "/admin/payouts-fixture?view=privy-admin",
    expectStudioNote: false,
  },
  {
    name: "admin-payouts-privy-admin-desktop-1440.png",
    width: 1440,
    height: 900,
    path: "/admin/payouts-fixture?view=privy-admin",
    expectStudioNote: false,
  },
];

async function main() {
  await mkdir(assetDir, { recursive: true });
  const browser = await chromium.launch();

  for (const shot of shots) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "domcontentloaded" });
    await waitForPayoutsFixture(page, shot.expectStudioNote);
    await page.screenshot({
      path: path.join(assetDir, shot.name),
      fullPage: true,
    });
    await context.close();
  }

  await browser.close();
  console.log(`Saved ${shots.length} screenshots to ${assetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
