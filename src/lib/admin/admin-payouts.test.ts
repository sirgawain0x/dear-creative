import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { writers } from "@/db/schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { loadAdminPayoutsSnapshot } from "./admin-payouts";

let testDb: LibSQLDatabase<typeof schema>;

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-admin-payouts-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

const WRITER_WALLET = "0x1111111111111111111111111111111111111111";
const SPLIT = "0x2222222222222222222222222222222222222222";
const TREASURY = "0xf46f1ba19a9280f752a451d0973b047d81c63d70";

describe("loadAdminPayoutsSnapshot", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.stubEnv("DEAR_PLATFORM_TREASURY_ADDRESS", TREASURY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns checksummed writer and treasury addresses", async () => {
    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_WALLET,
      payoutSplitAddress: SPLIT,
    });

    const snapshot = await loadAdminPayoutsSnapshot(testDb);
    expect(snapshot.payoutWalletAddress).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(snapshot.payoutSplitAddress).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(snapshot.treasuryAddress).toBe(
      "0xf46F1BA19A9280F752a451d0973b047D81c63D70",
    );
  });

  it("returns null fields when addresses are missing", async () => {
    await testDb.insert(writers).values({ id: randomUUID() });
    vi.stubEnv("DEAR_PLATFORM_TREASURY_ADDRESS", "");

    const snapshot = await loadAdminPayoutsSnapshot(testDb);
    expect(snapshot.payoutWalletAddress).toBeNull();
    expect(snapshot.payoutSplitAddress).toBeNull();
    expect(snapshot.treasuryAddress).toBeNull();
  });
});
