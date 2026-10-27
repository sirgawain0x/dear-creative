/**
 * Capture Adam chat waiting/streaming indicator screenshots (mocked API, no secrets).
 * Usage: PR_ASSET_DIR=docs/pr-assets/NN node scripts/capture-adam-chat-loading-screenshots.mjs
 * Requires dev server at http://127.0.0.1:3000
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const assetDir =
  process.env.PR_ASSET_DIR ?? "docs/pr-assets/adam-chat-loading";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const token = "fixture-studio-token-chat-loading";

async function mockRoutes(page) {
  await page.route("**/api/admin/config", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ privyConfigured: true, adamTokenConfigured: true }),
    }),
  );
  await page.route("**/api/admin/me", async (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ userId: "fixture", isAdmin: true }),
    }),
  );
  for (const pattern of [
    "**/api/adam/ideas**",
    "**/api/approvals**",
    "**/api/adam/schedule**",
    "**/api/adam/chat/threads**",
    "**/api/adam/posts**",
    "**/api/adam/cowriters/**",
  ]) {
    await page.route(pattern, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          pattern.includes("threads")
            ? { threads: [] }
            : pattern.includes("posts")
              ? { posts: [] }
              : pattern.includes("ideas")
                ? { ideas: [] }
                : pattern.includes("schedule")
                  ? {
                      schedule: {
                        enabled: false,
                        cronExpression: "0 9 * * 1",
                        timezone: "UTC",
                        instructions: "",
                      },
                    }
                  : {},
        ),
      });
    });
  }
}

async function main() {
  await mkdir(assetDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "no-preference",
  });
  await context.addInitScript((studioToken) => {
    localStorage.setItem("dear_creative_studio_token", studioToken);
  }, token);

  const page = await context.newPage();
  await mockRoutes(page);

  let releaseWaiting;
  const waitingGate = new Promise((resolve) => {
    releaseWaiting = resolve;
  });

  await page.route("**/api/adam/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await waitingGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply:
          "Here is a streamed-style fixture reply about editorial workflow and newsletter drafts.",
      }),
    });
  });

  await page.goto(`${baseUrl}/adam`, { waitUntil: "networkidle" });
  await page.getByLabel(/Message Adam/i).fill("Show loading states");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByTestId("adam-thinking-indicator").waitFor({ timeout: 15000 });
  await page.screenshot({
    path: path.join(assetDir, "adam-chat-waiting.png"),
    fullPage: false,
  });

  releaseWaiting();
  await page.getByTestId("adam-streaming-cue").waitFor({ timeout: 15000 });
  await page.screenshot({
    path: path.join(assetDir, "adam-chat-streaming.png"),
    fullPage: false,
  });

  await browser.close();
  console.log(`Saved screenshots under ${assetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
