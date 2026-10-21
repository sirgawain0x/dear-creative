import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const localDbUrl =
  process.env.LOCAL_DATABASE_URL ?? "file:./data/ci-dear-creative.db";

function seedHttpPostFixtures(): void {
  const dbPath = localDbUrl.replace(/^file:/, "");
  execSync(
    `sqlite3 ${JSON.stringify(dbPath)} ` +
      `"UPDATE posts SET is_gated = 1 WHERE slug = 'hello-dear-creative';` +
      `INSERT OR REPLACE INTO posts (id, slug, title, status, published_at, teaser_text, email_subject, email_html, body_html, source, is_gated, created_at, updated_at) ` +
      `SELECT 'seed-page-http-200-ungated', 'page-http-200-ungated', title, status, published_at, teaser_text, email_subject, email_html, body_html, source, 0, created_at, updated_at FROM posts WHERE slug = 'hello-dear-creative';"`,
    { stdio: "pipe" },
  );
}

const shouldRun = process.env.PAGE_HTTP_404_TEST === "1";
const describeHttp = shouldRun ? describe : describe.skip;

describeHttp("page routes return HTTP 404 before streaming (production server)", () => {
  const port = 31_404;
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: ChildProcess | null = null;

  beforeAll(async () => {
    seedHttpPostFixtures();
    try {
      execSync(`lsof -t -i:${port} | xargs -r kill -9`, { stdio: "ignore" });
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
    if (!existsSync(".next/BUILD_ID")) {
      execSync("npx next build", {
        stdio: "inherit",
        env: {
          ...process.env,
          LOCAL_DATABASE_URL: localDbUrl,
        },
      });
    }

    server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
      stdio: "pipe",
      env: {
        ...process.env,
        NEXT_PUBLIC_SITE_URL: baseUrl,
        LOCAL_DATABASE_URL: localDbUrl,
      },
    });

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${baseUrl}/`, { redirect: "manual" });
        if (res.status >= 200 && res.status < 600) {
          return;
        }
      } catch {
        // server still booting
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("next start did not become ready");
  }, 120_000);

  afterAll(async () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  async function headStatus(path: string): Promise<number> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "HEAD",
      redirect: "manual",
    });
    return res.status;
  }

  it("returns 404 for a missing post slug", async () => {
    expect(await headStatus("/posts/bogus-slug-notfound-check")).toBe(404);
  });

  it("returns 200 for a published ungated post", async () => {
    expect(await headStatus("/posts/page-http-200-ungated")).toBe(200);
  });

  it("returns 200 for a published gated post", async () => {
    expect(await headStatus("/posts/hello-dear-creative")).toBe(200);
  });

  it("returns 404 for author profiles when the flag is off", async () => {
    expect(await headStatus("/authors/missing-author-id")).toBe(404);
  });

  it("returns 404 for a missing author when the flag is on", async () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    }
    server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
      stdio: "pipe",
      env: {
        ...process.env,
        AUTHOR_PROFILES_ENABLED: "true",
        NEXT_PUBLIC_SITE_URL: baseUrl,
        LOCAL_DATABASE_URL: localDbUrl,
      },
    });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${baseUrl}/`, { redirect: "manual" });
        if (res.status >= 200 && res.status < 600) {
          break;
        }
      } catch {
        // wait
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(await headStatus("/authors/author-does-not-exist-404")).toBe(404);
  }, 120_000);
});
