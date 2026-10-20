/**
 * Renders admin UI fixtures with mocked metrics data and writes PNGs under docs/screenshots/.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "docs/screenshots");

const MOCK = {
  subscribers: { total: 1284, delta7d: 42, delta30d: 156 },
  emailDelivery: { sent: 120, delivered: 115, failed: 2, pending: 3, needsReview: 0 },
  socialDelivery: { posted: 48, failed: 1, pending: 2, needsReview: 1 },
  tipsRevenue: {
    totalUsdc: "2500000",
    totalTips: 17,
    perPost: [{ postId: "post-abc123", totalUsdc: "500000", tipCount: 3 }],
  },
  feedback: { helpful: 89, notHelpful: 12 },
  topPosts: [
    {
      postId: "post-1",
      slug: "welcome",
      title: "Welcome dispatch",
      deliveryCount: 400,
    },
  ],
  adam: {
    threadsCount: 6,
    recentThreads: [
      { id: "t1", title: "Draft ideas", updatedAt: "2026-10-01T12:00:00.000Z" },
    ],
    recentMessageCount: 24,
  },
  publishedPostsCount: 32,
};

function adminToolsMarkup() {
  const tools = [
    { href: "/adam", title: "Studio →", description: "Multimodal agent & drafts" },
    { href: "/approvals", title: "Approvals Queue →", description: "Review before dispatching" },
    { href: "/adam?tab=posts", title: "Manage Posts →", description: "Edit & Lens Grove banners" },
    { href: "/admin/metrics", title: "Metrics →", description: "Subscribers, delivery, and tips" },
  ];
  return `<div style="font-family:system-ui,sans-serif;padding:24px;max-width:720px">
    <h3 style="font-size:14px;font-weight:600">Owner Studio & Tools</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
      ${tools
        .map(
          (t) => `<a href="${t.href}" style="display:block;border:1px solid #e4e4e7;border-radius:12px;padding:14px;text-decoration:none;color:#18181b">
        <div style="font-size:14px;font-weight:600">${t.title}</div>
        <div style="font-size:11px;color:#71717a;margin-top:4px">${t.description}</div>
      </a>`,
        )
        .join("")}
    </div>
  </div>`;
}

function metricsMarkup() {
  const d = MOCK;
  return `<div style="font-family:system-ui,sans-serif;padding:24px;max-width:960px;color:#18181b">
    <a href="/admin" style="font-size:14px;color:#52525b">← Back to admin</a>
    <h1 style="font-size:30px;font-weight:700;margin:12px 0 8px">Metrics Dashboard</h1>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:16px">
      <div style="border:1px solid #e4e4e7;border-radius:16px;padding:20px"><div style="font-size:11px;color:#71717a;font-weight:600">TOTAL SUBSCRIBERS</div><div style="font-size:30px;font-weight:700;margin-top:8px">${d.subscribers.total}</div></div>
      <div style="border:1px solid #e4e4e7;border-radius:16px;padding:20px"><div style="font-size:11px;color:#71717a;font-weight:600">PUBLISHED POSTS</div><div style="font-size:30px;font-weight:700;margin-top:8px">${d.publishedPostsCount}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div style="border:1px solid #e4e4e7;border-radius:16px;padding:20px"><h3 style="font-size:14px;font-weight:600">Email Delivery</h3><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;text-align:center"><div><div style="font-size:24px;font-weight:700;color:#3b82f6">${d.emailDelivery.sent}</div><div style="font-size:11px;color:#71717a">Sent</div></div><div><div style="font-size:24px;font-weight:700;color:#22c55e">${d.emailDelivery.delivered}</div><div style="font-size:11px;color:#71717a">Delivered</div></div></div></div>
      <div style="border:1px solid #e4e4e7;border-radius:16px;padding:20px"><h3 style="font-size:14px;font-weight:600">Social Delivery (X)</h3><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;text-align:center"><div><div style="font-size:24px;font-weight:700;color:#22c55e">${d.socialDelivery.posted}</div><div style="font-size:11px;color:#71717a">Posted</div></div></div></div>
    </div>
    <div style="border:1px solid #e4e4e7;border-radius:16px;padding:20px;margin-top:16px"><h3 style="font-size:14px;font-weight:600">Tips Revenue (USDC)</h3><div style="font-size:24px;font-weight:700;margin-top:12px">${Number(d.tipsRevenue.totalUsdc) / 1_000_000}</div></div>
    <div style="border:1px solid #e4e4e7;border-radius:16px;padding:20px;margin-top:16px"><h3 style="font-size:14px;font-weight:600">Reader Feedback</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px"><div style="background:#ecfdf5;border-radius:12px;padding:16px;text-align:center"><div style="font-size:24px;font-weight:700;color:#047857">${d.feedback.helpful}</div><div style="font-size:11px;color:#71717a">Helpful</div></div><div style="background:#fffbeb;border-radius:12px;padding:16px;text-align:center"><div style="font-size:24px;font-weight:700;color:#b45309">${d.feedback.notHelpful}</div><div style="font-size:11px;color:#71717a">Not Helpful</div></div></div></div>
  </div>`;
}

function signInMarkup() {
  return `<div style="font-family:system-ui,sans-serif;padding:24px;max-width:720px">
    <p style="font-size:14px;color:#52525b">Sign in on the <a href="/admin" style="font-weight:600;color:#18181b">admin page</a> to view metrics.</p>
  </div>`;
}

async function screenshot(page, html, fileName, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fafafa">${html}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await screenshot(page, adminToolsMarkup(), "admin-owner-tools-four-cards.png", 720);
  await screenshot(page, metricsMarkup(), "admin-metrics-mocked-dashboard.png", 1100);
  await screenshot(page, signInMarkup(), "admin-metrics-sign-in-required.png", 720);
  await browser.close();
  console.log("Wrote screenshots to docs/screenshots/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
