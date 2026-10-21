import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const shouldRun = process.env.PAGE_HTTP_404_TEST === "1";
const describeHttp = shouldRun ? describe : describe.skip;

describeHttp("page routes return HTTP 404 before streaming (production server)", () => {
  const port = 31_404;
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: ChildProcess | null = null;

  beforeAll(async () => {
    if (!existsSync(".next/BUILD_ID")) {
      execSync("npx next build", {
        stdio: "inherit",
        env: {
          ...process.env,
          LOCAL_DATABASE_URL:
            process.env.LOCAL_DATABASE_URL ?? "file:./data/ci-dear-creative.db",
        },
      });
    }

    server = spawn("npm", ["run", "start", "--", "-p", String(port)], {
      stdio: "pipe",
      env: {
        ...process.env,
        NEXT_PUBLIC_SITE_URL: baseUrl,
        LOCAL_DATABASE_URL:
          process.env.LOCAL_DATABASE_URL ?? "file:./data/ci-dear-creative.db",
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
        LOCAL_DATABASE_URL:
          process.env.LOCAL_DATABASE_URL ?? "file:./data/ci-dear-creative.db",
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
