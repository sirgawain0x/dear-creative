import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import { authors, posts, readerPostUnlockPurchases, writers } from "@/db/schema";
import {
  loadReaderPostUnlockContext,
  verifyAndRecordPostUnlock,
} from "./reader-checkout-service";
import {
  resetReaderCheckoutReceiptReaderForTests,
  setReaderCheckoutReceiptReaderForTests,
} from "./reader-checkout-receipt";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import { setPaywallEnabledForTests } from "./feature-flag";

const PAYEE = "0xfc1577e86d0bc18c562a92e7e3a748e7177902af";
const PAYER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX1 =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

let testDb: DearCreativeDb;

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-reader-unlock-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as DearCreativeDb;
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

describe("reader post unlock service", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.stubEnv("POST_UNLOCK_PRICE_USDC", "1");
    setReaderCheckoutReceiptReaderForTests({
      fetchTransfer: vi.fn().mockResolvedValue({
        from: PAYER,
        to: PAYEE,
        value: BigInt(1_000000),
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

  it("does not offer Unlock subscription UI context on ungated posts", async () => {
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

    const ctx = await loadReaderPostUnlockContext(testDb, "only-free");
    expect(ctx).toBeNull();
  });

  it("sets showUnlockProtocolSubscribeOffer when the writer has gated posts", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    const ctx = await loadReaderPostUnlockContext(testDb, "paid-one");
    expect(ctx?.showUnlockProtocolSubscribeOffer).toBe(true);
    expect(ctx?.unlockPriceUsdc).toBe(1);
  });

  it("rejects reused tx hash for a different post", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    const otherPostId = randomUUID();
    await testDb.insert(posts).values({
      id: otherPostId,
      slug: "paid-two",
      title: "Paid 2",
      authorId: writerId,
      status: "published",
      publishedAt: new Date(),
      isGated: true,
    });

    await testDb.insert(readerPostUnlockPurchases).values({
      id: randomUUID(),
      privyUserId: "did:privy:u1",
      walletAddress: PAYER,
      writerId,
      postId: otherPostId,
      txHash: TX1,
      chainId: 8453,
      tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
      amountRaw: "1000000",
    });

    await expect(
      verifyAndRecordPostUnlock(testDb, {
        slug: "paid-one",
        txHash: TX1,
        walletAddress: PAYER,
        privyUserId: "did:privy:u1",
      }),
    ).rejects.toMatchObject({ code: "tx_hash_reused", status: 409 });
  });

  it("rejects reused tx hash for the same post from a different wallet", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    const postId = (
      await testDb.query.posts.findFirst({
        where: (postsTable, { eq }) => eq(postsTable.slug, "paid-one"),
      })
    )!.id;

    await testDb.insert(readerPostUnlockPurchases).values({
      id: randomUUID(),
      privyUserId: "did:privy:u1",
      walletAddress: PAYER,
      writerId,
      postId,
      txHash: TX1,
      chainId: 8453,
      tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
      amountRaw: "1000000",
    });

    const otherWallet = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    await expect(
      verifyAndRecordPostUnlock(testDb, {
        slug: "paid-one",
        txHash: TX1,
        walletAddress: otherWallet,
        privyUserId: "did:privy:u1",
      }),
    ).rejects.toMatchObject({ code: "tx_hash_reused", status: 409 });
  });

  it("returns idempotent ok when the same wallet retries the same tx", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");
    const postId = (
      await testDb.query.posts.findFirst({
        where: (postsTable, { eq }) => eq(postsTable.slug, "paid-one"),
      })
    )!.id;

    const recordId = randomUUID();
    await testDb.insert(readerPostUnlockPurchases).values({
      id: recordId,
      privyUserId: "did:privy:u1",
      walletAddress: PAYER,
      writerId,
      postId,
      txHash: TX1,
      chainId: 8453,
      tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
      amountRaw: "1000000",
    });

    const result = await verifyAndRecordPostUnlock(testDb, {
      slug: "paid-one",
      txHash: TX1,
      walletAddress: PAYER,
      privyUserId: "did:privy:u1",
    });
    expect(result).toEqual({ recordId, idempotent: true });
  });

  it("returns idempotent ok when concurrent inserts race on tx_hash unique", async () => {
    const writerId = "g2";
    await seedWriterAndGatedPost(writerId, "paid-one");

    const input = {
      slug: "paid-one",
      txHash: TX1,
      walletAddress: PAYER,
      privyUserId: "did:privy:u1",
    };

    const [first, second] = await Promise.all([
      verifyAndRecordPostUnlock(testDb, input),
      verifyAndRecordPostUnlock(testDb, input),
    ]);

    const idempotentFlags = [first.idempotent, second.idempotent].sort();
    expect(idempotentFlags).toEqual([false, true]);
    expect(first.recordId).toBe(second.recordId);
  });
});
