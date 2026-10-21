import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authors, subscriptions, unlocks, writers } from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import {
  canReadFull,
  resolveSubscriptionAccess,
  resolveUnlockAccess,
} from "./can-read-full";
import type { PostViewer } from "./viewer-types";

describe("canReadFull", () => {
  it("allows ungated posts for anonymous viewers", async () => {
    const db = await createPostsTestDb();
    expect(
      await canReadFull(
        db,
        { isGated: false, authorId: null, postId: "p1" },
        null,
      ),
    ).toBe(true);
  });

  it("blocks gated posts for anonymous viewers", async () => {
    const db = await createPostsTestDb();
    expect(
      await canReadFull(
        db,
        { isGated: true, authorId: "w1", postId: "p1" },
        null,
      ),
    ).toBe(false);
  });

  it("allows admin and author writers", async () => {
    const db = await createPostsTestDb();
    const admin: PostViewer = {
      privyUserId: "did:privy:admin",
      linkedWalletAddresses: [],
      isAdmin: true,
      writerId: null,
    };
    expect(
      await canReadFull(
        db,
        { isGated: true, authorId: "w1", postId: "p1" },
        admin,
      ),
    ).toBe(true);

    const authorViewer: PostViewer = {
      privyUserId: "did:privy:writer",
      linkedWalletAddresses: [],
      isAdmin: false,
      writerId: "w1",
    };
    expect(
      await canReadFull(
        db,
        { isGated: true, authorId: "w1", postId: "p1" },
        authorViewer,
      ),
    ).toBe(true);
  });

  it("grants access when the viewer wallet has an unlock row for this post", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "target-post",
      title: "Target",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
    });
    const target = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "target-post"),
    });
    if (!target) throw new Error("missing post");

    const viewer: PostViewer = {
      privyUserId: "did:privy:buyer",
      linkedWalletAddresses: ["0xBuyerWallet00000000000000000000000001"],
      isAdmin: false,
      writerId: null,
    };

    expect(
      await canReadFull(
        db,
        { isGated: true, authorId: null, postId: target.id },
        viewer,
      ),
    ).toBe(false);

    await db.insert(unlocks).values({
      id: randomUUID(),
      postId: target.id,
      walletAddress: "0xbuyerwallet00000000000000000000000001",
      payMethod: "x402_usdc",
    });

    expect(
      await canReadFull(
        db,
        { isGated: true, authorId: null, postId: target.id },
        viewer,
      ),
    ).toBe(true);
  });

  it("denies access when unlock row exists for a different post", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "post-a",
      title: "A",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
    });
    await insertPost(db, {
      slug: "post-b",
      title: "B",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
    });
    const postA = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "post-a"),
    });
    const postB = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "post-b"),
    });
    if (!postA || !postB) throw new Error("missing posts");

    await db.insert(unlocks).values({
      id: randomUUID(),
      postId: postA.id,
      walletAddress: "0xbuyerwallet00000000000000000000000001",
      payMethod: "x402_usdc",
    });

    const viewer: PostViewer = {
      privyUserId: "did:privy:buyer",
      linkedWalletAddresses: ["0xBuyerWallet00000000000000000000000001"],
      isAdmin: false,
      writerId: null,
    };

    expect(
      await canReadFull(
        db,
        { isGated: true, authorId: null, postId: postB.id },
        viewer,
      ),
    ).toBe(false);
  });

  it("grants active subscribers", async () => {
    const db = await createPostsTestDb();
    const writerId = randomUUID();
    await db.insert(writers).values({ id: writerId });
    await db.insert(authors).values({
      id: writerId,
      name: "Writer",
      slug: `writer-${writerId.slice(0, 8)}`,
      payoutAddress: "0x0000000000000000000000000000000000000001",
    });
    await insertPost(db, {
      slug: "gated-sub",
      title: "Gated",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
      authorId: writerId,
    });
    const row = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "gated-sub"),
    });
    if (!row) throw new Error("missing post");

    const basePost = {
      isGated: true,
      authorId: writerId,
      postId: row.id,
    };

    const subscriber: PostViewer = {
      privyUserId: "did:privy:sub",
      linkedWalletAddresses: [],
      isAdmin: false,
      writerId: null,
    };
    expect(await canReadFull(db, basePost, subscriber)).toBe(false);

    await db.insert(subscriptions).values({
      id: randomUUID(),
      privyUserId: "did:privy:sub",
      wallet: "0x0000000000000000000000000000000000000001",
      writerId,
      plan: "monthly",
      periodStart: new Date(Date.now() - 86_400_000),
      periodEnd: new Date(Date.now() + 86_400_000),
      status: "active",
    });
    expect(await canReadFull(db, basePost, subscriber)).toBe(true);

    const expiredSubViewer: PostViewer = {
      privyUserId: "did:privy:expired",
      linkedWalletAddresses: [],
      isAdmin: false,
      writerId: null,
    };
    await db.insert(subscriptions).values({
      id: randomUUID(),
      privyUserId: "did:privy:expired",
      wallet: "0x0000000000000000000000000000000000000002",
      writerId,
      plan: "monthly",
      periodStart: new Date(Date.now() - 172_800_000),
      periodEnd: new Date(Date.now() - 86_400_000),
      status: "active",
    });
    expect(await canReadFull(db, basePost, expiredSubViewer)).toBe(false);
  });

  it("resolveSubscriptionAccess requires period_end in the future", async () => {
    const db = await createPostsTestDb();
    const writerId = randomUUID();
    await db.insert(writers).values({ id: writerId });
    await db.insert(subscriptions).values({
      id: randomUUID(),
      privyUserId: "did:privy:free",
      wallet: "0x1",
      writerId,
      plan: "monthly",
      periodStart: new Date("2020-01-01"),
      periodEnd: new Date("2020-02-01"),
      status: "active",
    });
    expect(
      await resolveSubscriptionAccess(db, {
        privyUserId: "did:privy:free",
        writerId,
        asOf: new Date("2026-01-01"),
      }),
    ).toBe(false);
  });

  it("resolveUnlockAccess matches lowercase wallet addresses", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "unlock-wallet",
      title: "Unlock",
      status: "published",
      publishedAt: new Date(),
    });
    const row = await db.query.posts.findFirst({
      where: (p, { eq }) => eq(p.slug, "unlock-wallet"),
    });
    if (!row) throw new Error("missing post");
    await db.insert(unlocks).values({
      id: randomUUID(),
      postId: row.id,
      walletAddress: "0xabc",
      payMethod: "x402_usdc",
    });
    expect(
      await resolveUnlockAccess(db, {
        postId: row.id,
        walletAddresses: ["0xABC"],
      }),
    ).toBe(true);
  });
});
