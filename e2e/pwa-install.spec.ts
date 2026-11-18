import { expect, test } from "@playwright/test";

test("serves install metadata, registers the worker, and recovers offline", async ({ page, context }) => {
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "Dear Creative, on your home screen." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Install app", exact: true })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ name: "Dear Creative", start_url: "/", scope: "/", display: "standalone" });
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  const workerResponse = await page.request.get("/sw.js");
  expect(workerResponse.headers()["cache-control"]).toContain("no-store");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Let’s reconnect." })).toBeVisible();
  expect(await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.filter((key) => key.startsWith("dear-creative-offline-")).map(async (key) =>
      (await (await caches.open(key)).keys()).map((request) => new URL(request.url).pathname),
    ))).flat();
  })).toEqual(["/offline.html"]);

  await context.setOffline(false);
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "Dear Creative, on your home screen." })).toBeVisible();
});

test("keeps installation help within a narrow mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/install");
  await expect(page.getByRole("region", { name: "Install Dear Creative" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
