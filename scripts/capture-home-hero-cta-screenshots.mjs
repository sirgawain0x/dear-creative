/**
 * Hero CTA row on the live homepage (local DB fixtures, no prod secrets).
 *
 *   mkdir -p .local data
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run db:migrate:local
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run seed:home-spotlight
 *   LOCAL_DATABASE_URL=file:.local/dear-creative.db npm run dev
 *   node scripts/capture-home-hero-cta-screenshots.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";
const ARTIFACT_DIR =
  process.env.PR_ASSET_DIR ?? "/opt/cursor/artifacts/screenshots";

const shots = [
  {
    name: "homepage-hero-cta-375",
    viewport: { width: 375, height: 812 },
  },
  {
    name: "homepage-hero-cta-1440",
    viewport: { width: 1440, height: 900 },
  },
];

async function waitForServer(url, attempts = 90) {
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
    const page = await browser.newPage({ viewport: shot.viewport });
    await page.goto(`${BASE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector("main h1", { timeout: 30_000 });
    const heroCta = page.getByRole("link", { name: "Subscribe Free" });
    await expectVisible(heroCta);
    await page.waitForTimeout(800);
    const out = `${ARTIFACT_DIR}/${shot.name}.png`;
    await heroCta.scrollIntoViewIfNeeded();
    const box = await page.locator("main").boundingBox();
    if (box) {
      const clipHeight = Math.min(box.height, shot.viewport.height);
      await page.screenshot({
        path: out,
        clip: { x: box.x, y: box.y, width: box.width, height: clipHeight },
      });
    } else {
      await page.screenshot({ path: out, fullPage: false });
    }
    console.log("Saved", out);
    await page.close();
  }
  await browser.close();
}

async function expectVisible(locator) {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
