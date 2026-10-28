/**
 * Homepage + /posts archive screenshots (local DB fixtures, no prod).
 *
 *   mkdir -p .local
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run seed:home-spotlight
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run dev
 *   node scripts/capture-homepage-archive-screenshots.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";
const ARTIFACT_DIR =
  process.env.PR_ASSET_DIR ?? "/opt/cursor/artifacts/screenshots";

const shots = [
  {
    name: "homepage-desktop-1280",
    path: "/",
    viewport: { width: 1280, height: 900 },
  },
  {
    name: "homepage-mobile-390",
    path: "/",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "posts-archive-desktop-1280",
    path: "/posts",
    viewport: { width: 1280, height: 900 },
  },
  {
    name: "posts-archive-mobile-390",
    path: "/posts",
    viewport: { width: 390, height: 844 },
  },
];

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready at ${url}`);
}

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await waitForServer(BASE);

  const browser = await chromium.launch();
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: shot.viewport,
    });
    await page.goto(`${BASE}${shot.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector("main", { timeout: 30_000 });
    await page.waitForTimeout(1200);
    const out = `${ARTIFACT_DIR}/${shot.name}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log("Saved", out);
    await page.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
