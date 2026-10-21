/**
 * Admin Funds + Earn stacked layout (fixture).
 * Usage: node scripts/capture-admin-panels-layout.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ??
  "/opt/cursor/artifacts/screenshots/admin-panels-layout";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const shots = [
  { name: "admin-panels-390.png", width: 390 },
  { name: "admin-panels-desktop.png", width: 1280 },
];

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 1200 },
  });
  await page.goto(`${baseUrl}/admin/panels-layout-fixture`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("admin-console-panels-stack").waitFor({ state: "visible" });
  await page.getByTestId("admin-wallet-receive-qr").waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(assetDir, shot.name),
    fullPage: true,
  });
  await page.close();
}

await browser.close();
console.log("Saved admin panels layout screenshots to", assetDir);
