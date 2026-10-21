/**
 * Capture /adam mobile overflow PR screenshots (fixture API mocks, no secrets).
 * Usage: PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-adam-mobile-screenshots.mjs
 * Requires dev server at http://127.0.0.1:3000
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/adam-mobile-overflow";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const token = "fixture-studio-token-layout-test";

function mockPosts(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fixture-post-${i}`,
    slug:
      i === 0
        ? `fixture-long-slug-${"x".repeat(72)}`
        : `fixture-post-slug-${i}`,
    title: `Fixture Post ${i}: editorial list card title`,
    status: i % 4 === 0 ? "draft" : "published",
    publishedAt: i % 4 === 0 ? null : "2024-06-15T14:00:00.000Z",
    teaser: "Fixture teaser.",
    emailSubject: `Subject ${i}`,
    markdown: "# Fixture\n\nBody.",
    html: "<p>Body.</p>",
    bannerUrl: null,
    audioUrl: null,
    audioVoice: null,
  }));
}

async function mockRoutes(page) {
  await page.route("**/api/adam/posts**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts: mockPosts(40) }),
    });
  });
  await page.route("**/api/admin/me", async (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ userId: "fixture", isAdmin: true }),
    }),
  );
  await page.route("**/api/adam/ideas**", async (route) =>
    route.fulfill({ status: 200, body: '{"ideas":[]}' }),
  );
  await page.route("**/api/approvals**", async (route) =>
    route.fulfill({ status: 200, body: '{"approvals":[]}' }),
  );
  await page.route("**/api/adam/schedule**", async (route) =>
    route.fulfill({
      status: 200,
      body: '{"schedule":{"enabled":false,"cronExpression":"0 9 * * 1","timezone":"UTC","instructions":""}}',
    }),
  );
  await page.route("**/api/adam/chat/**", async (route) =>
    route.fulfill({ status: 200, body: '{"threads":[]}' }),
  );
}

const shots = [
  { name: "adam-posts-mobile-360.png", width: 360 },
  { name: "adam-posts-mobile-390.png", width: 390 },
  { name: "adam-posts-desktop-1440.png", width: 1440 },
];

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();
const measurements = {};

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: 900 },
  });
  await page.addInitScript((t) => {
    localStorage.setItem("dear_creative_studio_token", t);
  }, token);
  await mockRoutes(page);
  await page.goto(`${baseUrl}/adam?tab=posts`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    noHorizontalOverflow:
      document.documentElement.scrollWidth <= window.innerWidth,
  }));
  measurements[shot.width] = metrics;
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
