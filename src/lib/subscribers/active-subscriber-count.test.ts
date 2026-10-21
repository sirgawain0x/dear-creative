import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";
import type { DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import { subscribers, subscriptions, writers } from "@/db/schema";
import {
  formatActiveSubscriberCount,
  queryActiveSubscriberCount,
} from "./active-subscriber-count";

async function createTestDb(): Promise<DearCreativeDb> {
  const dir = mkdtempSync(join(tmpdir(), "dear-active-count-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as DearCreativeDb;
}

describe("queryActiveSubscriberCount", () => {
  it("counts confirmed free subscribers and active paid subscriptions", async () => {
    const db = await createTestDb();
    const asOf = new Date("2026-10-20T12:00:00.000Z");

    await db.insert(subscribers).values([
      {
        id: randomUUID(),
        email: "active-free@example.test",
        status: "subscribed",
        source: "signup",
        subscribedAt: asOf,
      },
      {
        id: randomUUID(),
        email: "pending@example.test",
        status: "pending",
        source: "signup",
      },
      {
        id: randomUUID(),
        email: "left@example.test",
        status: "unsubscribed",
        source: "signup",
        unsubscribedAt: asOf,
      },
    ]);

    const writerId = randomUUID();
    await db.insert(writers).values({ id: writerId });
    await db.insert(subscriptions).values([
      {
        id: randomUUID(),
        privyUserId: "did:privy:paid-active",
        wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        writerId,
        plan: "monthly",
        periodStart: new Date("2026-10-01T00:00:00.000Z"),
        periodEnd: new Date("2026-11-01T00:00:00.000Z"),
        status: "active",
      },
      {
        id: randomUUID(),
        privyUserId: "did:privy:paid-expired",
        wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        writerId,
        plan: "monthly",
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-01T00:00:00.000Z"),
        status: "active",
      },
    ]);

    const total = await queryActiveSubscriberCount(db, asOf);
    expect(total).toBe(2);
  });

  it("returns zero when no active subscribers exist", async () => {
    const db = await createTestDb();
    expect(await queryActiveSubscriberCount(db)).toBe(0);
  });
});

describe("formatActiveSubscriberCount", () => {
  it("formats with thousands separators", () => {
    expect(formatActiveSubscriberCount(1284)).toBe("1,284");
  });
});
