/**
 * Site header reader account dropdown screenshots.
 * Signed-out: real home with READER_WALLET_ENABLED (+ dev e2e gate for local capture).
 * Signed-in menus: /reader/site-header-fixture (real SiteHeader; dev-only gate).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ??
  "/opt/cursor/artifacts/screenshots/reader-account-dropdown-site-header";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const fixtureBase = `${baseUrl}/reader/site-header-fixture`;

function fixtureScope(page) {
  return page.getByTestId("site-header-fixture");
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
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
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

const signedInHeaderShots = [
  { label: "header-signed-in-390", width: 390 },
  { label: "header-signed-in-840", width: 840 },
];

for (const shot of signedInHeaderShots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.goto(fixtureBase, { waitUntil: "domcontentloaded" });
  const trigger =
    shot.width >= 1024
      ? fixtureScope(page).getByTestId("reader-wallet-header-button")
      : fixtureScope(page).getByTestId("reader-wallet-header-button-mobile");
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
  await page.goto(fixtureBase, { waitUntil: "domcontentloaded" });
  const trigger = shot.mobile
    ? fixtureScope(page).getByTestId("reader-wallet-header-button-mobile")
    : fixtureScope(page).getByTestId("reader-wallet-header-button");
  await trigger.waitFor({ state: "visible", timeout: 20_000 });
  await trigger.click();
  if (shot.mobile) {
    await page.getByTestId("reader-account-sheet").waitFor({ state: "visible" });
  } else {
    await page.getByTestId("reader-account-dropdown").waitFor({ state: "visible" });
    await page.getByTestId("reader-account-menu-actions").waitFor({ state: "visible" });
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

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${fixtureBase}/admin`, { waitUntil: "domcontentloaded" });
  const trigger = page.getByRole("button", { name: "Open account menu" });
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

{
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(fixtureBase, { waitUntil: "domcontentloaded" });
  await fixtureScope(page).getByTestId("reader-wallet-header-button-mobile").click();
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
