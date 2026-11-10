import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { subscribers } from "@/db/schema";
import {
  resetBotIdCheckForTests,
  setBotIdCheckForTests,
} from "@/lib/botid/verify";
import { resetRateLimitStoreForTests } from "@/lib/rate-limit/memory";
import { SUBSCRIBE_HTTP_ACK } from "@/lib/subscribers/subscribe-response";
import { POST } from "./route";

let testDb: ReturnType<typeof drizzle>;

const resendSendMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "mock-email-id" }),
);

vi.mock("@/db/client", () => ({
  getDb: () => testDb,
}));

vi.mock("@/lib/resend/client", () => ({
  getResendClient: () => ({
    send: resendSendMock,
  }),
  getResendFromAddress: () => "newsletter@example.test",
}));

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-subscribe-route-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("POST /api/subscribe", () => {
  beforeEach(async () => {
    resetRateLimitStoreForTests();
    testDb = await createTestDb();
    resendSendMock.mockClear();
    vi.stubEnv("SUBSCRIBER_TOKEN_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    vi.stubEnv("RESEND_API_KEY", "re_test_mock_key");
    setBotIdCheckForTests(async () => ({ isBot: false }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetBotIdCheckForTests();
    resetRateLimitStoreForTests();
  });

  async function postSubscribe(
    email: string,
    host = "https://evil-scanner.example",
    extra?: { signupSrc?: string | null },
  ) {
    return POST(
      new Request(`${host}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...extra }),
      }),
    );
  }

  it("never calls the live Resend API even when RESEND_API_KEY is set", async () => {
    await postSubscribe("resend-mock@example.test");
    expect(resendSendMock).toHaveBeenCalledTimes(1);
  });

  it("returns the same 200 body for new, pending, subscribed, unsubscribed, and bounced", async () => {
    const cases: { email: string; setup?: () => Promise<void> }[] = [
      { email: "new@example.test" },
      {
        email: "pending@example.test",
        setup: async () => {
          await testDb.insert(subscribers).values({
            id: randomUUID(),
            email: "pending@example.test",
            status: "pending",
            source: "signup",
          });
        },
      },
      {
        email: "live@example.test",
        setup: async () => {
          await testDb.insert(subscribers).values({
            id: randomUUID(),
            email: "live@example.test",
            status: "subscribed",
            source: "signup",
          });
        },
      },
      {
        email: "optout@example.test",
        setup: async () => {
          await testDb.insert(subscribers).values({
            id: randomUUID(),
            email: "optout@example.test",
            status: "unsubscribed",
            source: "signup",
          });
        },
      },
      {
        email: "bounced@example.test",
        setup: async () => {
          await testDb.insert(subscribers).values({
            id: randomUUID(),
            email: "bounced@example.test",
            status: "bounced",
            source: "resend_webhook",
          });
        },
      },
    ];

    const bodies: unknown[] = [];
    for (const { email, setup } of cases) {
      if (setup) {
        await setup();
      }
      const response = await postSubscribe(email);
      expect(response.status).toBe(200);
      bodies.push(await response.json());
    }

    for (const body of bodies) {
      expect(body).toEqual(SUBSCRIBE_HTTP_ACK);
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });

  it("returns 503 when NEXT_PUBLIC_SITE_URL is missing (never uses Host)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const response = await postSubscribe("any@example.test");
    expect(response.status).toBe(503);
  });

  it("still returns 400 for invalid email", async () => {
    const response = await postSubscribe("not-an-email");
    expect(response.status).toBe(400);
  });

  it("persists signupSrc for new subscribers via the API", async () => {
    const response = await postSubscribe("api-src@example.test", undefined, {
      signupSrc: "yt",
    });
    expect(response.status).toBe(200);
    const [row] = await testDb
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "api-src@example.test"));
    expect(row?.signupSrc).toBe("yt");
  });

  it("persists signup_src from dc_signup_src cookie when body omits signupSrc", async () => {
    const response = await POST(
      new Request("https://dear.example.test/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "dc_signup_src=hashnode",
        },
        body: JSON.stringify({ email: "cookie-src@example.test" }),
      }),
    );
    expect(response.status).toBe(200);
    const [row] = await testDb
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "cookie-src@example.test"));
    expect(row?.signupSrc).toBe("hashnode");
  });

  it("does not overwrite signup_src on existing pending rows when using cookie fallback", async () => {
    await testDb.insert(subscribers).values({
      id: randomUUID(),
      email: "pending-cookie@example.test",
      status: "pending",
      source: "signup",
      signupSrc: "ctv",
    });
    const response = await POST(
      new Request("https://dear.example.test/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "dc_signup_src=yt",
        },
        body: JSON.stringify({ email: "pending-cookie@example.test" }),
      }),
    );
    expect(response.status).toBe(200);
    const [row] = await testDb
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, "pending-cookie@example.test"));
    expect(row?.signupSrc).toBe("ctv");
  });

  it("returns 403 when BotID flags the request as a bot", async () => {
    setBotIdCheckForTests(async () => ({ isBot: true }));
    const response = await postSubscribe("new@example.test");
    expect(response.status).toBe(403);
  });
});
