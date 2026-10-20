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
import { getAddress } from "viem";
import {
  findWriterByPayoutWalletMatch,
  loadAdminPayoutsSnapshot,
} from "./admin-payouts";

let testDb: LibSQLDatabase<typeof schema>;

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-admin-payouts-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

const WRITER_A_WALLET = "0x1111111111111111111111111111111111111111";
const WRITER_A_SPLIT = "0x2222222222222222222222222222222222222222";
const WRITER_B_WALLET = "0x3333333333333333333333333333333333333333";
const WRITER_B_SPLIT = "0x4444444444444444444444444444444444444444";
const TREASURY = "0xf46f1ba19a9280f752a451d0973b047d81c63d70";

describe("findWriterByPayoutWalletMatch", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  it("matches a writer when a linked wallet equals payout_wallet_address", async () => {
    const id = randomUUID();
    await testDb.insert(writers).values({
      id,
      payoutWalletAddress: WRITER_A_WALLET,
      payoutSplitAddress: WRITER_A_SPLIT,
    });

    const writer = await findWriterByPayoutWalletMatch(testDb, [
      getAddress(WRITER_A_WALLET),
    ]);
    expect(writer?.id).toBe(id);
  });

  it("matches mixed-case stored payout_wallet_address", async () => {
    const id = randomUUID();
    const mixedCaseWallet =
      "0xAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    await testDb.insert(writers).values({
      id,
      payoutWalletAddress: mixedCaseWallet,
      payoutSplitAddress: WRITER_A_SPLIT,
    });

    const writer = await findWriterByPayoutWalletMatch(testDb, [
      getAddress(mixedCaseWallet),
    ]);
    expect(writer?.id).toBe(id);
  });

  it("returns null when no writer shares the linked wallet", async () => {
    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_A_WALLET,
    });

    const writer = await findWriterByPayoutWalletMatch(testDb, [
      getAddress(WRITER_B_WALLET),
    ]);
    expect(writer).toBeNull();
  });

  it("returns the writer for the signed-in wallet when two writers exist", async () => {
    const writerAId = randomUUID();
    const writerBId = randomUUID();
    await testDb.insert(writers).values([
      {
        id: writerAId,
        payoutWalletAddress: WRITER_A_WALLET,
        payoutSplitAddress: WRITER_A_SPLIT,
      },
      {
        id: writerBId,
        payoutWalletAddress: WRITER_B_WALLET,
        payoutSplitAddress: WRITER_B_SPLIT,
      },
    ]);

    const writerForB = await findWriterByPayoutWalletMatch(testDb, [
      getAddress(WRITER_B_WALLET),
    ]);
    expect(writerForB?.id).toBe(writerBId);
    expect(writerForB?.payoutSplitAddress).toBe(WRITER_B_SPLIT);
  });
});

describe("loadAdminPayoutsSnapshot", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.stubEnv("DEAR_PLATFORM_TREASURY_ADDRESS", TREASURY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns checksummed writer and treasury addresses on wallet match", async () => {
    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_A_WALLET,
      payoutSplitAddress: WRITER_A_SPLIT,
    });

    const snapshot = await loadAdminPayoutsSnapshot(testDb, {
      privyLinkedWalletAddresses: [getAddress(WRITER_A_WALLET)],
    });
    expect(snapshot.payoutWalletAddress).toBe(getAddress(WRITER_A_WALLET));
    expect(snapshot.payoutSplitAddress).toBe(getAddress(WRITER_A_SPLIT));
    expect(snapshot.treasuryAddress).toBe(getAddress(TREASURY));
  });

  it("returns null writer fields when linked wallets do not match any writer", async () => {
    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_A_WALLET,
      payoutSplitAddress: WRITER_A_SPLIT,
    });

    const snapshot = await loadAdminPayoutsSnapshot(testDb, {
      privyLinkedWalletAddresses: [getAddress(WRITER_B_WALLET)],
    });
    expect(snapshot.payoutWalletAddress).toBeNull();
    expect(snapshot.payoutSplitAddress).toBeNull();
    expect(snapshot.treasuryAddress).toBe(getAddress(TREASURY));
  });

  it("returns null writer fields for Adam token (no Privy linked wallets) while keeping treasury", async () => {
    await testDb.insert(writers).values({
      id: randomUUID(),
      payoutWalletAddress: WRITER_A_WALLET,
      payoutSplitAddress: WRITER_A_SPLIT,
    });

    const snapshot = await loadAdminPayoutsSnapshot(testDb, {
      privyLinkedWalletAddresses: null,
    });
    expect(snapshot.payoutWalletAddress).toBeNull();
    expect(snapshot.payoutSplitAddress).toBeNull();
    expect(snapshot.treasuryAddress).toBe(getAddress(TREASURY));
  });

  it("returns null fields when writer row addresses are missing", async () => {
    await testDb.insert(writers).values({ id: randomUUID() });
    vi.stubEnv("DEAR_PLATFORM_TREASURY_ADDRESS", "");

    const snapshot = await loadAdminPayoutsSnapshot(testDb, {
      privyLinkedWalletAddresses: [getAddress(WRITER_A_WALLET)],
    });
    expect(snapshot.payoutWalletAddress).toBeNull();
    expect(snapshot.payoutSplitAddress).toBeNull();
    expect(snapshot.treasuryAddress).toBeNull();
  });
});
