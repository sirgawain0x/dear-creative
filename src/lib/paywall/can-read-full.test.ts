import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authors, subscriptions, unlocks, writers } from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import {
  canReadFull,
  resolveCanReadFullPost,
  resolveSubscriptionAccess,
  resolveUnlockAccess,
} from "./can-read-full";
import type { PostViewer } from "./viewer-types";

describe("canReadFull", () => {
  it("allows ungated posts for anonymous viewers", () => {
    expect(
      canReadFull(
        { isGated: false, authorId: null, postId: "p1" },
        null,
      ),
    ).toBe(true);
  });

  it("blocks gated posts for anonymous viewers", () => {
    expect(
      canReadFull(
        { isGated: true, authorId: "w1", postId: "p1" },
        null,
      ),
    ).toBe(false);
  });

  it("allows admin and author writers", () => {
    const viewer: PostViewer = {
      privyUserId: "did:privy:admin",
      linkedWalletAddresses: [],
      isAdmin: true,
      writerId: null,
    };
    expect(
      canReadFull(
        { isGated: true, authorId: "w1", postId: "p1" },
        viewer,
      ),
    ).toBe(true);

    const authorViewer: PostViewer = {
      privyUserId: "did:privy:writer",
      linkedWalletAddresses: [],
      isAdmin: false,
      writerId: "w1",
    };
    expect(
      canReadFull(
        { isGated: true, authorId: "w1", postId: "p1" },
        authorViewer,
      ),
    ).toBe(true);
  });
});

describe("resolveCanReadFullPost", () => {
  it("grants active subscribers and unlock holders", async () => {
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
      freeContent: "Free section",
      gatedContent: "SECRET_GATED_MARKER",
      bodyHtml: "<p>Free</p><p>SECRET_GATED_MARKER</p>",
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
    expect(await resolveCanReadFullPost(db, basePost, subscriber)).toBe(false);

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
    expect(await resolveCanReadFullPost(db, basePost, subscriber)).toBe(true);

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
    expect(
      await resolveCanReadFullPost(db, basePost, expiredSubViewer),
    ).toBe(false);

    const unlockViewer: PostViewer = {
      privyUserId: "did:privy:unlock",
      linkedWalletAddresses: ["0xAbCdEf0123456789012345678901234567890AbCd"],
      isAdmin: false,
      writerId: null,
    };
    await db.insert(unlocks).values({
      id: randomUUID(),
      postId: row.id,
      walletAddress: "0xabcdef0123456789012345678901234567890abcd",
      payMethod: "x402_usdc",
    });
    expect(await resolveCanReadFullPost(db, basePost, unlockViewer)).toBe(true);
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
