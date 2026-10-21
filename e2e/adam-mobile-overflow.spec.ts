import { test, expect, type Page } from "@playwright/test";
import {
  buildAdamPostsFixture,
  STUDIO_TOKEN_FIXTURE,
} from "./fixtures/adam-posts-fixture";
import { READER_WALLET_E2E_STORAGE_KEY } from "../src/lib/wallet/reader-wallet-e2e-auth";

async function mockAdamStudioApis(page: Page) {
  const posts = buildAdamPostsFixture(40);

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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ideas: [] }),
    });
  });

  await page.route("**/api/approvals**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ approvals: [] }),
    });
  });

  await page.route("**/api/adam/schedule**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
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

  await page.route("**/api/adam/chat/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ threads: [] }),
    });
  });
}

async function installStudioFixtureSession(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((token) => {
    localStorage.setItem("dear_creative_studio_token", token);
  }, STUDIO_TOKEN_FIXTURE);
  await mockAdamStudioApis(page);
}

async function openAdamPostsTab(page: Page, width: number) {
  await installStudioFixtureSession(page, width);
  await page.goto("/adam?tab=posts", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Posts & Archive" })).toBeVisible({
    timeout: 15_000,
  });
}

async function openApprovalsPage(page: Page, width: number) {
  await installStudioFixtureSession(page, width);
  await page.goto("/approvals", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Editorial Approval Queue" }),
  ).toBeVisible({ timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
}

async function expectStudioMainPadding(page: Page) {
  const paddingLeft = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return 0;
    return parseFloat(getComputedStyle(main).paddingLeft);
  });
  expect(paddingLeft).toBeGreaterThan(0);
}

const mobileWidths = [360, 390, 768] as const;

for (const width of mobileWidths) {
  test(`/adam posts tab has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await openAdamPostsTab(page, width);
    await expectNoHorizontalOverflow(page);
  });
}

test("/adam posts tab has no horizontal overflow at 1440px desktop", async ({
  page,
}) => {
  await openAdamPostsTab(page, 1440);
  await expectNoHorizontalOverflow(page);
});

const allViewportWidths = [360, 390, 768, 1440] as const;

for (const width of allViewportWidths) {
  test(`/approvals has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await openApprovalsPage(page, width);
    await expectNoHorizontalOverflow(page);
    await expectStudioMainPadding(page);
  });
}
