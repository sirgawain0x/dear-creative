/**
 * Capture admin payouts PR screenshots (fixture API mocks, no secrets).
 * Usage:
 *   ADMIN_PAYOUTS_FIXTURE=true PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-admin-payouts-screenshots.mjs
 * Requires dev server at http://127.0.0.1:3000
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
const STUDIO_TOKEN_FIXTURE = "fixture-studio-token-layout-test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/admin-payouts-privy";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

async function mockAdminConfig(page) {
  await page.route("**/api/admin/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        privyConfigured: true,
        adamTokenConfigured: true,
        walletEnabled: false,
      }),
    });
  });
}

const shots = [
  {
    name: "admin-payouts-studio-note-mobile-390.png",
    width: 390,
    height: 844,
    path: "/admin",
    studioKey: true,
  },
  {
    name: "admin-payouts-studio-note-desktop-1440.png",
    width: 1440,
    height: 900,
    path: "/admin",
    studioKey: true,
  },
  {
    name: "admin-payouts-privy-admin-mobile-390.png",
    width: 390,
    height: 844,
    path: "/admin/payouts-fixture?view=privy-admin",
    studioKey: false,
  },
  {
    name: "admin-payouts-privy-admin-desktop-1440.png",
    width: 1440,
    height: 900,
    path: "/admin/payouts-fixture?view=privy-admin",
    studioKey: false,
  },
];

async function main() {
  await mkdir(assetDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockAdminConfig(page);

  for (const shot of shots) {
    if (shot.studioKey) {
      await context.addInitScript((token) => {
        window.localStorage.setItem("dear_creative_studio_token", token);
      }, STUDIO_TOKEN_FIXTURE);
    } else {
      await context.clearCookies();
      await page.addInitScript(() => {
        window.localStorage.removeItem("dear_creative_studio_token");
      });
    }

    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
    if (shot.studioKey) {
      await page.getByTestId("admin-payouts-privy-sign-in-note").waitFor();
    } else {
      await page.getByTestId("admin-payouts-card").waitFor();
    }
    await page.screenshot({
      path: path.join(assetDir, shot.name),
      fullPage: true,
    });
  }

  await browser.close();
  console.log(`Saved ${shots.length} screenshots to ${assetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
