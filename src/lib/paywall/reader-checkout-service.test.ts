import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { authors, posts, readerCheckoutRecords, writers } from "@/db/schema";
import {
  loadReaderCheckoutContext,
  verifyAndRecordPostUnlock,
  verifyAndRecordSubscription,
} from "./reader-checkout-service";
import {
  resetReaderCheckoutReceiptReaderForTests,
  setReaderCheckoutReceiptReaderForTests,
} from "./reader-checkout-receipt";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import { setPaywallEnabledForTests } from "./feature-flag";
import { resolveSubscriptionAccess } from "./can-read-full";

const PAYEE = "0xfc150000000000000000000000000000000002af";
const PAYER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX1 =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const TX2 =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

let testDb: ReturnType<typeof drizzle>;

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-reader-checkout-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedWriterAndGatedPost(writerId: string, slug: string) {
  await testDb.insert(writers).values({
    id: writerId,
    payoutSplitAddress: PAYEE,
    payoutWalletAddress: PAYER,
  });
  await testDb.insert(authors).values({
    id: writerId,
    name: "G2",
    slug: "g2",
    payoutAddress: PAYER,
  });
  await testDb.insert(posts).values({
    id: randomUUID(),
    slug,
    title: "Paid post",
    authorId: writerId,
    status: "published",
    publishedAt: new Date(),
    isGated: true,
  });
}

describe("reader checkout service", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "2");
    setReaderCheckoutReceiptReaderForTests({
      fetchTransfer: vi.fn().mockResolvedValue({
        from: PAYER,
        to: PAYEE,
        value: BigInt(2_000000),
        confirmations: 3,
        logEmitter: BASE_USDC_ADDRESS,
      }),
    });
  });

  afterEach(() => {
    resetReaderCheckoutReceiptReaderForTests();
    vi.unstubAllEnvs();
    setPaywallEnabledForTests(undefined);
  });

  it("hides subscribe in context when the writer has no gated posts", async () => {
    const writerId = "writer-no-gated";
    await testDb.insert(writers).values({
      id: writerId,
      payoutSplitAddress: PAYEE,
    });
    await testDb.insert(authors).values({
      id: writerId,
      name: "Solo",
      slug: "solo",
      payoutAddress: PAYER,
    });
    await testDb.insert(posts).values({
      id: randomUUID(),
      slug: "only-free",
      title: "Free",
      authorId: writerId,
      status: "published",
      publishedAt: new Date(),
      isGated: false,
    });

    const ctx = await loadReaderCheckoutContext(testDb, "only-free");
    expect(ctx).toBeNull();
  });

  it("includes subscribe plans when the writer has gated posts", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    const ctx = await loadReaderCheckoutContext(testDb, "paid-one");
    expect(ctx?.showSubscribe).toBe(true);
    expect(ctx?.subscriptionPlans).toHaveLength(2);
    expect(ctx?.unlockPriceUsdc).toBe(2);
  });

  it("rejects reused tx hash for a different checkout kind", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    await testDb.insert(readerCheckoutRecords).values({
      id: randomUUID(),
      kind: "subscription",
      privyUserId: "did:privy:u1",
      walletAddress: PAYER,
      writerId,
      postId: null,
      plan: "monthly",
      txHash: TX1,
      chainId: 8453,
      tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
      amountRaw: "8000000",
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 86400000),
    });

    await expect(
      verifyAndRecordPostUnlock(testDb, {
        slug: "paid-one",
        txHash: TX1,
        walletAddress: PAYER,
        privyUserId: "did:privy:u1",
      }),
    ).rejects.toMatchObject({ code: "tx_hash_reused" });
  });

  it("grants subscription access until period_end then expires", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    const periodEnd = new Date("2030-01-01T00:00:00.000Z");
    await verifyAndRecordSubscription(testDb, {
      writerId,
      plan: "monthly",
      txHash: TX2,
      walletAddress: PAYER,
      privyUserId: "did:privy:sub",
      nowMs: periodEnd.getTime() - 30 * 86400000,
    });

    const active = await resolveSubscriptionAccess(testDb, {
      privyUserId: "did:privy:sub",
      writerId,
      asOf: new Date("2029-12-15T00:00:00.000Z"),
    });
    expect(active).toBe(true);

    const expired = await resolveSubscriptionAccess(testDb, {
      privyUserId: "did:privy:sub",
      writerId,
      asOf: new Date("2030-01-02T00:00:00.000Z"),
    });
    expect(expired).toBe(false);
  });
});
