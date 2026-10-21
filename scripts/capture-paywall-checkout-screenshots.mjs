import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const outDir = join(process.cwd(), "docs/pr-assets/reader-checkout-pr-c");
mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-50 text-zinc-900">
  <section class="mx-auto my-10 max-w-3xl rounded-2xl border border-amber-200/80 bg-amber-50/80 p-8">
    <p class="text-xs font-semibold uppercase tracking-wider text-amber-800">Subscriber content</p>
    <h2 class="mt-2 text-center text-2xl font-semibold">Continue reading &ldquo;Dispatch #42&rdquo;</h2>
    <p class="mx-auto mt-3 max-w-md text-center text-sm text-zinc-600">Pay USDC on Base directly to the writer's split. Sign with your Privy wallet.</p>
    <p class="mx-auto mt-4 max-w-md rounded-lg border border-amber-300/60 bg-white/70 px-4 py-3 text-center text-sm">Your subscription ends Jan 2, 2027. Renew below to keep full access.</p>
    <div class="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
      <button class="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white">Unlock this post · 2 USDC</button>
      <div class="flex flex-col items-center gap-2">
        <label class="text-xs font-medium text-zinc-600">Subscribe to this writer
          <select class="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option>$8 / 30 days</option>
            <option>$80 / 365 days</option>
          </select>
        </label>
        <button class="rounded-full border border-zinc-900 px-6 py-2.5 text-sm font-medium">Subscribe with USDC</button>
      </div>
    </div>
  </section>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });

for (const [name, width] of [
  ["paywall-checkout-mobile-390.png", 390],
  ["paywall-checkout-desktop-1440.png", 1440],
]) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({
    path: join(outDir, name),
    fullPage: true,
  });
}

await browser.close();
console.log(`Saved screenshots to ${outDir}`);
