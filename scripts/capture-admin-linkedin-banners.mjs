/**
 * Capture LinkedIn OAuth callback banner screenshots (fixture page, no secrets).
 * Usage:
 *   PR_ASSET_DIR=/opt/cursor/artifacts/admin-linkedin-banners node scripts/capture-admin-linkedin-banners.mjs
 * Requires dev server at http://127.0.0.1:3000
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/linkedin-callback-banners";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const errorReasons = [
  "session_missing",
  "not_admin",
  "invalid_state",
  "did_mismatch",
  "token_exchange_failed",
  "userinfo_failed",
  "user_cancelled",
  "access_denied",
  "oauth_invalid_request",
  "oauth_unauthorized_client",
  "oauth_unsupported_response",
  "oauth_invalid_scope",
  "oauth_server_error",
  "oauth_temporarily_unavailable",
  "oauth_denied",
];

/** @type {{ file: string; query: string }[]} */
const shots = [
  { file: "linkedin-banner-connected.png", query: "linkedin=connected" },
  ...errorReasons.map((reason) => ({
    file: `linkedin-banner-error-${reason}.png`,
    query: `linkedin=error&reason=${reason}`,
  })),
  {
    file: "linkedin-banner-error-unknown-fallback.png",
    query: "linkedin=error&reason=not_a_real_callback_code",
  },
];

async function main() {
  await mkdir(assetDir, { recursive: true });
  const browser = await chromium.launch();

  for (const shot of shots) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `${baseUrl}/admin/linkedin-connect-fixture?${shot.query}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByTestId("admin-linkedin-callback-banner").waitFor({
      state: "visible",
    });
    await page.screenshot({
      path: path.join(assetDir, shot.file),
      fullPage: false,
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
