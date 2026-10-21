import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const outDir = join(process.cwd(), "docs/pr-assets/94");
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
    <p class="mx-auto mt-3 max-w-md text-center text-sm text-zinc-600">Unlock this post with a one-time USDC payment on Base. Pay directly to the writer's split with your Privy wallet.</p>
    <div class="mt-8 flex flex-col items-center gap-4">
      <button type="button" class="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white">Unlock this post · 1 USDC</button>
      <p class="max-w-md text-center text-xs text-zinc-600">Writer subscriptions ($8 / 30 days or $80 / 365 days) will use <strong>Unlock Protocol</strong> with auto-renewal — scope only; see <code class="text-[11px]">docs/paywall/unlock-subscriptions-scope.md</code>.</p>
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
