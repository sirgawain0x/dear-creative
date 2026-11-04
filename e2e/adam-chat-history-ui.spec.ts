import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  ADAM_CHAT_OVERFLOW_THREAD_ID,
  buildAdamChatOverflowMessages,
  buildAdamChatOverflowThreadList,
} from "./fixtures/adam-chat-overflow-fixture";
import {
  buildAdamPostsFixture,
  STUDIO_TOKEN_FIXTURE,
} from "./fixtures/adam-posts-fixture";
import { READER_WALLET_E2E_STORAGE_KEY } from "../src/lib/wallet/reader-wallet-e2e-auth";

const PR_ASSET_DIR = "docs/pr-assets/adam-chat-history-ui";

async function installStudioFixtureSession(
  page: import("@playwright/test").Page,
  width: number,
) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(
    ({ token, e2eKey }) => {
      localStorage.setItem(e2eKey, "1");
      localStorage.setItem("dear_creative_studio_token", token);
    },
    { token: STUDIO_TOKEN_FIXTURE, e2eKey: READER_WALLET_E2E_STORAGE_KEY },
  );
}

async function mockAdamStudioApis(page: import("@playwright/test").Page) {
  const posts = buildAdamPostsFixture(40);
  await page.route("**/api/admin/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        privyConfigured: false,
        adamTokenConfigured: true,
      }),
    });
  });
  await page.route("**/api/adam/posts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts }),
    });
  });
  await page.route("**/api/admin/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ userId: "fixture-user", isAdmin: true }),
    });
  });
  await page.route("**/api/adam/ideas**", async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ ideas: [] }) });
  });
  await page.route("**/api/approvals**", async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ approvals: [] }) });
  });
  await page.route("**/api/adam/schedule**", async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        schedule: {
          enabled: false,
          cronExpression: "0 9 * * 1",
          timezone: "America/New_York",
          instructions: "",
        },
      }),
    });
  });
}

async function mockAdamChatThreads(page: import("@playwright/test").Page) {
  const threads = [
    ...buildAdamChatOverflowThreadList(),
    {
      id: "thread_fixture_second",
      title: "Second thread",
      summary: null,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  await page.route("**/api/adam/chat/threads", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ threads }),
      });
      return;
    }
    await route.continue();
  });

  for (const threadId of [ADAM_CHAT_OVERFLOW_THREAD_ID, "thread_fixture_second"]) {
    await page.route(`**/api/adam/chat/threads/${threadId}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            thread: threads.find((t) => t.id === threadId),
            messages: buildAdamChatOverflowMessages(),
          }),
        });
        return;
      }
      await route.continue();
    });
  }
}

async function openAdamChat(page: import("@playwright/test").Page, width: number) {
  await installStudioFixtureSession(page, width);
  await mockAdamStudioApis(page);
  await mockAdamChatThreads(page);
  await page.goto("/adam?tab=chat", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("adam-chat-thread-history")).toBeVisible({
    timeout: 15_000,
  });
}

for (const { width, tag } of [
  { width: 375, tag: "mobile-375" },
  { width: 1440, tag: "desktop-1440" },
] as const) {
  test(`Adam chat history UI screenshots (${tag})`, async ({ page }) => {
    test.setTimeout(60_000);
    await openAdamChat(page, width);
    const outDir = join(process.cwd(), PR_ASSET_DIR);
    mkdirSync(outDir, { recursive: true });

    await page.getByTestId("adam-chat-thread-history-trigger").click();
    await expect(page.getByTestId("adam-chat-thread-history-list")).toBeVisible();
    await page.screenshot({
      path: join(outDir, `history-open-${tag}.png`),
      fullPage: false,
    });

    const renameSecond = page.getByRole("button", { name: "Rename Second thread" });
    await renameSecond.scrollIntoViewIfNeeded();
    await renameSecond.click();
    await expect(page.getByLabel("Conversation title")).toBeVisible();
    await page.screenshot({
      path: join(outDir, `history-rename-${tag}.png`),
      fullPage: false,
    });

    await page
      .getByTestId("adam-chat-thread-rename-thread_fixture_second")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(
      page.getByRole("button", { name: "Delete Second thread" }),
    ).toBeVisible();
    const deleteSecond = page.getByRole("button", { name: "Delete Second thread" });
    await deleteSecond.scrollIntoViewIfNeeded();
    await deleteSecond.click();
    await expect(
      page.getByTestId("adam-chat-thread-delete-confirm-thread_fixture_second"),
    ).toBeVisible();
    await page.screenshot({
      path: join(outDir, `history-delete-confirm-${tag}.png`),
      fullPage: false,
    });

    const userBubble = page.getByTestId("adam-user-message-body").first();
    await expect(userBubble).toBeVisible({ timeout: 10_000 });
    await userBubble.screenshot({
      path: join(outDir, `user-bubble-after-${tag}.png`),
    });
  });
}
