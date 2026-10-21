/**
 * PR #90: /adam and site header screenshots (logged out + studio-key signed in).
 * Usage: node scripts/capture-pr-90-auth-ui-screenshots.mjs
 * Requires dev server at http://127.0.0.1:3000
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir = "docs/pr-assets/90";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const studioToken = "fixture-studio-token-pr-90-screenshots";

async function mockAdamApis(page) {
  await page.route("**/api/adam/**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    if (url.includes("/posts")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [] }),
      });
    }
    if (url.includes("/ideas")) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({ ideas: [] }),
      });
    }
    if (url.includes("/schedule")) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          schedule: {
            enabled: false,
            cronExpression: "0 9 * * 1",
            timezone: "UTC",
            instructions: "",
          },
        }),
      });
    }
    if (url.includes("/chat")) {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({ threads: [] }),
      });
    }
    return route.continue();
  });
  await page.route("**/api/admin/me", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ userId: "fixture-user", isAdmin: true }),
    }),
  );
  await page.route("**/api/approvals**", async (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ approvals: [] }),
    }),
  );
}

function overflowMetrics() {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    noHorizontalOverflow:
      document.documentElement.scrollWidth <= window.innerWidth,
  };
}

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();
const measurements = {};

const headerShots = [
  { key: "headerLoggedOut390", file: "header-logged-out-390.png", width: 390, signedIn: false },
  { key: "headerLoggedOut1440", file: "header-logged-out-1440.png", width: 1440, signedIn: false },
  { key: "headerLoggedIn390", file: "header-logged-in-390.png", width: 390, signedIn: true },
  { key: "headerLoggedIn1440", file: "header-logged-in-1440.png", width: 1440, signedIn: true },
];

for (const shot of headerShots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  if (shot.signedIn) {
    await page.addInitScript((t) => {
      localStorage.setItem("dear_creative_studio_token", t);
    }, studioToken);
    await mockAdamApis(page);
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem("dear_creative_studio_token");
    });
  }
  await page.goto(`${baseUrl}/adam`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const header = page.locator("header").first();
  await header.waitFor({ state: "visible", timeout: 60_000 });
  if (shot.width < 1024) {
    const menu = page.getByRole("button", { name: /toggle navigation menu/i });
    if (await menu.isVisible()) {
      await menu.click();
      await page.waitForTimeout(400);
    }
  }
  measurements[shot.key] = await page.evaluate(overflowMetrics);
  await header.screenshot({ path: path.join(assetDir, shot.file) });
  await page.close();
}

const adamShots = [
  { key: "adamLoggedOut390", file: "adam-logged-out-390.png", width: 390, signedIn: false },
  { key: "adamLoggedOut1440", file: "adam-logged-out-1440.png", width: 1440, signedIn: false },
  { key: "adamLoggedIn390", file: "adam-logged-in-390.png", width: 390, signedIn: true },
  { key: "adamLoggedIn1440", file: "adam-logged-in-1440.png", width: 1440, signedIn: true },
];

for (const shot of adamShots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  if (shot.signedIn) {
    await page.addInitScript((t) => {
      localStorage.setItem("dear_creative_studio_token", t);
    }, studioToken);
    await mockAdamApis(page);
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem("dear_creative_studio_token");
    });
  }
  await page.goto(`${baseUrl}/adam`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  measurements[shot.key] = await page.evaluate(overflowMetrics);
  await page.screenshot({
    path: path.join(assetDir, shot.file),
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
