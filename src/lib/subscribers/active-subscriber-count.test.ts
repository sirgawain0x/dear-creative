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
  ACTIVE_SUBSCRIBER_IDENTITY_LINK,
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

const SHARED_WALLET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

describe("queryActiveSubscriberCount", () => {
  it("counts distinct people across free and paid with expired paid excluded", async () => {
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
        wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        writerId,
        plan: "monthly",
        periodStart: new Date("2026-10-01T00:00:00.000Z"),
        periodEnd: new Date("2026-11-01T00:00:00.000Z"),
        status: "active",
      },
      {
        id: randomUUID(),
        privyUserId: "did:privy:paid-expired",
        wallet: "0xcccccccccccccccccccccccccccccccccccccccc",
        writerId,
        plan: "monthly",
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
        periodEnd: new Date("2026-09-01T00:00:00.000Z"),
        status: "active",
      },
    ]);

    const total = await queryActiveSubscriberCount(db, asOf);
    expect(total).toBe(2);
    expect(ACTIVE_SUBSCRIBER_IDENTITY_LINK).toContain("subscribers.email");
  });

  it("dedupes free list + active paid to one when email matches subscription wallet", async () => {
    const db = await createTestDb();
    const asOf = new Date("2026-10-20T12:00:00.000Z");
    const writerId = randomUUID();
    await db.insert(writers).values({ id: writerId });

    await db.insert(subscribers).values({
      id: randomUUID(),
      email: SHARED_WALLET,
      status: "subscribed",
      source: "signup",
      subscribedAt: asOf,
    });

    await db.insert(subscriptions).values({
      id: randomUUID(),
      privyUserId: "did:privy:same-person",
      wallet: SHARED_WALLET,
      writerId,
      plan: "monthly",
      periodStart: new Date("2026-10-01T00:00:00.000Z"),
      periodEnd: new Date("2026-11-01T00:00:00.000Z"),
      status: "active",
    });

    expect(await queryActiveSubscriberCount(db, asOf)).toBe(1);
  });

  it("dedupes multiple active paid rows for the same privy user", async () => {
    const db = await createTestDb();
    const asOf = new Date("2026-10-20T12:00:00.000Z");
    const writerA = randomUUID();
    const writerB = randomUUID();
    await db.insert(writers).values([{ id: writerA }, { id: writerB }]);

    const privyUserId = "did:privy:multi-writer";
    await db.insert(subscriptions).values([
      {
        id: randomUUID(),
        privyUserId,
        wallet: "0xdddddddddddddddddddddddddddddddddddddddd",
        writerId: writerA,
        plan: "monthly",
        periodStart: new Date("2026-10-01T00:00:00.000Z"),
        periodEnd: new Date("2026-11-01T00:00:00.000Z"),
        status: "active",
      },
      {
        id: randomUUID(),
        privyUserId,
        wallet: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        writerId: writerB,
        plan: "yearly",
        periodStart: new Date("2026-10-01T00:00:00.000Z"),
        periodEnd: new Date("2027-10-01T00:00:00.000Z"),
        status: "active",
      },
    ]);

    expect(await queryActiveSubscriberCount(db, asOf)).toBe(1);
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
