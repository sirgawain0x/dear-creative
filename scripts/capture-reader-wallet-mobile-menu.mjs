/**
 * Before/after screenshots for backdrop-blur containing-block + Next fixture.
 * PHASE=before uses fixed overlay inside header; PHASE=after portals overlay to body.
 * Usage: PHASE=before|after node scripts/capture-reader-wallet-mobile-menu.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const phase = process.env.PHASE ?? "after";
const assetDir =
  process.env.PR_ASSET_DIR ??
  `/opt/cursor/artifacts/screenshots/wallet-menu-${phase}`;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const usePortal = phase === "after";

const widths = [
  { label: "390", width: 390, height: 844 },
  { label: "600", width: 600, height: 900 },
  { label: "840", width: 840, height: 900 },
];

function htmlRepro(portal) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  body { margin: 0; font-family: system-ui, sans-serif; min-height: 120vh; background: #fafafa; }
  header {
    position: sticky; top: 0; z-index: 40;
    border-bottom: 1px solid #e4e4e7;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .bar { display: flex; justify-content: space-between; padding: 14px 16px; }
  .overlay {
    position: fixed; inset: 0; z-index: 50;
    display: flex; justify-content: flex-end;
    background: rgba(24,24,27,0.4);
  }
  aside {
    width: min(100%, 28rem); height: 100%; background: #fff;
    border-left: 1px solid #e4e4e7; padding: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,.12);
  }
  .content { padding: 24px; color: #52525b; }
</style></head><body>
  <header id="hdr">
    <div class="bar"><strong>Dear Creative</strong><span>Wallet open</span></div>
    <div id="overlay-host"></div>
  </header>
  <div class="content"><p>Page content under sticky header (Fold / mobile repro).</p></div>
  <script>
    const portal = ${portal ? "true" : "false"};
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = '<aside role="dialog"><h2>Wallet</h2><p>Reader wallet panel</p><button type="button">Close</button></aside>';
    const host = document.getElementById('overlay-host');
    if (portal) {
      document.body.appendChild(overlay);
    } else {
      host.appendChild(overlay);
    }
  </script>
</body></html>`;
}

await mkdir(assetDir, { recursive: true });
const browser = await chromium.launch();

for (const vp of widths) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });

  await page.setContent(htmlRepro(usePortal), { waitUntil: "load" });
  const cssMetrics = await page.evaluate(() => {
    const overlay = document.querySelector(".overlay");
    const aside = document.querySelector("aside");
    if (!overlay || !aside) return null;
    const o = overlay.getBoundingClientRect();
    const a = aside.getBoundingClientRect();
    return {
      overlayHeight: o.height,
      sheetHeight: a.height,
      innerHeight: window.innerHeight,
      parentTag: overlay.parentElement?.id === "overlay-host" ? "HEADER" : overlay.parentElement?.tagName,
    };
  });
  console.log(`${phase} CSS repro ${vp.label}px:`, cssMetrics);

  await page.screenshot({
    path: path.join(assetDir, `wallet-menu-css-${vp.label}-${phase}.png`),
    fullPage: false,
  });

  try {
    await page.goto(`${baseUrl}/reader/header-wallet-fixture`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.getByTestId("reader-wallet-header-button-mobile").click();
    await page.getByRole("button", { name: "Close" }).waitFor({ timeout: 8000 });
    const appMetrics = await page.evaluate(() => {
      const overlay = document.querySelector(
        '[data-testid="reader-wallet-sheet-overlay"]',
      );
      const sheet = document.querySelector('[data-testid="reader-wallet-sheet"]');
      if (!overlay || !sheet) return null;
      return {
        overlayHeight: overlay.getBoundingClientRect().height,
        sheetHeight: sheet.getBoundingClientRect().height,
        innerHeight: window.innerHeight,
        parentTag: overlay.parentElement?.tagName ?? null,
      };
    });
    console.log(`${phase} Next fixture ${vp.label}px:`, appMetrics);
    await page.screenshot({
      path: path.join(assetDir, `wallet-menu-app-${vp.label}-${phase}.png`),
      fullPage: false,
    });
  } catch (err) {
    console.warn(`${phase} Next fixture ${vp.label}px skipped:`, err.message);
  }

  await page.close();
}

await browser.close();
console.log(`Saved ${phase} screenshots to ${assetDir}`);
