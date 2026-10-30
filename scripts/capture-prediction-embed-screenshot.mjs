import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const outDir = path.join(process.cwd(), "docs/pr-assets");
const outFile = path.join(outDir, "prediction-link-embed-card.png");
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000";

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 520 } });
  await page.goto(`${baseUrl}/reader/prediction-embed-fixture`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("prediction-link-embed-card").waitFor({ timeout: 15_000 });
  await page.getByTestId("prediction-link-embed-card").screenshot({ path: outFile });
  await browser.close();
  console.log(`Saved ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
