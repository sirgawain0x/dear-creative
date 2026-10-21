import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  authors,
  postWriters,
  posts,
  writerGroupSplits,
  writerInvites,
} from "@/db/schema";
import { acceptCowriterInvite } from "./accept-invite";
import {
  setCowritersEnabledForTests,
} from "./feature-flag";
import { createCowriterInvite, removeCowriterMembership } from "./invites";
import { hashInviteToken } from "./invite-token";
import { assertCanAddCowriter, listActivePostWriters } from "./membership";
import {
  assertCowriterPublishAllowed,
  CowriterPublishBlockedError,
  evaluateCowriterPublishGate,
} from "./publish-gate";
import { computeWriterGroupKey } from "./group-key";

async function createMigratedDb() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { client, db };
}

function sumActiveShareBps(
  rows: Awaited<ReturnType<typeof listActivePostWriters>>,
): number {
  return rows.reduce((total, row) => total + row.shareBps, 0);
}

describe("co-writer invites and limits", () => {
  beforeEach(() => {
    setCowritersEnabledForTests(true);
  });

  afterEach(() => {
    setCowritersEnabledForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("stores invite tokens as hashes only", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "p1",
      slug: "p1",
      title: "Post",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:p1",
      postId: "p1",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const created = await createCowriterInvite(db, {
      postId: "p1",
      invitedBy: "admin",
      email: "cowriter@example.com",
      inviteBaseUrl: "https://news.example.com",
    });

    expect(created.inviteUrl).toContain("token=");
    const token = created.inviteUrl.split("token=")[1]!;
    const decoded = decodeURIComponent(token);
    expect(decoded.length).toBeGreaterThan(20);

    const rows = await client.execute(
      "SELECT token_hash FROM writer_invites LIMIT 1",
    );
    const stored = rows.rows[0]?.token_hash as string;
    expect(stored).toBe(hashInviteToken(decoded));
    expect(stored).not.toContain(decoded);

    client.close();
  });

  it("enforces max five co-writers", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `cw-${i}`,
      postId: "p1",
      role: "cowriter" as const,
      shareBps: 2000,
      status: "accepted" as const,
    }));
    expect(() => assertCanAddCowriter(rows)).toThrow(/At most 5 co-writers/);
  });

  it("accepts invite when Privy identity matches email", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "p2",
      slug: "p2",
      title: "Post 2",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:p2",
      postId: "p2",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const created = await createCowriterInvite(db, {
      postId: "p2",
      invitedBy: "admin",
      email: "writer@example.com",
      inviteBaseUrl: "https://news.example.com",
    });
    const token = decodeURIComponent(created.inviteUrl.split("token=")[1]!);

    const result = await acceptCowriterInvite(db, token, {
      emails: ["writer@example.com"],
      wallets: [],
    });
    expect(result.ok).toBe(true);

    const memberships = await listActivePostWriters(db, "p2");
    expect(memberships.some((m) => m.role === "cowriter" && m.status === "accepted")).toBe(
      true,
    );

    client.close();
  });

  it("backfills author membership and splits 5000/5000 for a new post plus one co-writer", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(authors).values({
      id: "author-new",
      name: "Primary",
      slug: "primary",
      payoutAddress: "0x1111111111111111111111111111111111111111",
    });
    await db.insert(posts).values({
      id: "post-new",
      slug: "post-new",
      title: "New post",
      status: "draft",
      authorId: "author-new",
    });

    const created = await createCowriterInvite(db, {
      postId: "post-new",
      invitedBy: "admin",
      email: "cowriter@example.com",
      inviteBaseUrl: "https://news.example.com",
    });
    const token = decodeURIComponent(created.inviteUrl.split("token=")[1]!);

    const accepted = await acceptCowriterInvite(db, token, {
      emails: ["cowriter@example.com"],
      wallets: [],
    });
    expect(accepted.ok).toBe(true);

    const memberships = await listActivePostWriters(db, "post-new");
    expect(memberships).toHaveLength(2);
    const authorRow = memberships.find((m) => m.role === "author");
    const cowriterRow = memberships.find((m) => m.role === "cowriter");
    expect(authorRow?.shareBps).toBe(5000);
    expect(cowriterRow?.shareBps).toBe(5000);
    expect(authorRow?.writerId).toBe("author-new");

    client.close();
  });

  it("returns already_used on a second accept", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "p-dup",
      slug: "p-dup",
      title: "Dup",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:p-dup",
      postId: "p-dup",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const created = await createCowriterInvite(db, {
      postId: "p-dup",
      invitedBy: "admin",
      email: "dup@example.com",
      inviteBaseUrl: "https://news.example.com",
    });
    const token = decodeURIComponent(created.inviteUrl.split("token=")[1]!);
    const identity = { emails: ["dup@example.com"], wallets: [] as string[] };

    expect((await acceptCowriterInvite(db, token, identity)).ok).toBe(true);
    const second = await acceptCowriterInvite(db, token, identity);
    expect(second).toEqual({ ok: false, reason: "already_used" });

    client.close();
  });

  it("returns already_used when the invite is expired", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "p-exp",
      slug: "p-exp",
      title: "Expired",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:p-exp",
      postId: "p-exp",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const created = await createCowriterInvite(db, {
      postId: "p-exp",
      invitedBy: "admin",
      email: "expired@example.com",
      inviteBaseUrl: "https://news.example.com",
    });
    const token = decodeURIComponent(created.inviteUrl.split("token=")[1]!);

    await db
      .update(writerInvites)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(writerInvites.id, created.inviteId));

    const result = await acceptCowriterInvite(db, token, {
      emails: ["expired@example.com"],
      wallets: [],
    });
    expect(result).toEqual({ ok: false, reason: "already_used" });

    client.close();
  });

  it("does not create an author row when accept fails on a wallet invite", async () => {
    const cowriterWallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "p-wallet",
      slug: "p-wallet",
      title: "Wallet invite",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:p-wallet",
      postId: "p-wallet",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const created = await createCowriterInvite(db, {
      postId: "p-wallet",
      invitedBy: "admin",
      wallet: cowriterWallet,
      inviteBaseUrl: "https://news.example.com",
    });
    const token = decodeURIComponent(created.inviteUrl.split("token=")[1]!);
    const identity = { emails: [] as string[], wallets: [cowriterWallet] };

    const authorCountBefore = (
      await db.select({ id: authors.id }).from(authors)
    ).length;

    await db
      .update(writerInvites)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(writerInvites.id, created.inviteId));

    const expired = await acceptCowriterInvite(db, token, identity);
    expect(expired).toEqual({ ok: false, reason: "already_used" });
    expect((await db.select({ id: authors.id }).from(authors)).length).toBe(
      authorCountBefore,
    );

    await db
      .update(writerInvites)
      .set({
        expiresAt: new Date(Date.now() + 60_000),
        status: "pending",
      })
      .where(eq(writerInvites.id, created.inviteId));

    const first = await acceptCowriterInvite(db, token, identity);
    expect(first.ok).toBe(true);
    const afterFirst = (await db.select({ id: authors.id }).from(authors)).length;
    expect(afterFirst).toBe(authorCountBefore + 1);

    const second = await acceptCowriterInvite(db, token, identity);
    expect(second).toEqual({ ok: false, reason: "already_used" });
    expect((await db.select({ id: authors.id }).from(authors)).length).toBe(
      afterFirst,
    );

    client.close();
  });

  it("keeps active writer shares summing to 10000 after invite, accept, and remove", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "p-sum",
      slug: "p-sum",
      title: "Share sum",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:p-sum",
      postId: "p-sum",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const created = await createCowriterInvite(db, {
      postId: "p-sum",
      invitedBy: "admin",
      email: "split@example.com",
      inviteBaseUrl: "https://news.example.com",
    });
    let rows = await listActivePostWriters(db, "p-sum");
    expect(sumActiveShareBps(rows)).toBe(10_000);

    const token = decodeURIComponent(created.inviteUrl.split("token=")[1]!);
    await acceptCowriterInvite(db, token, {
      emails: ["split@example.com"],
      wallets: [],
    });
    rows = await listActivePostWriters(db, "p-sum");
    expect(sumActiveShareBps(rows)).toBe(10_000);

    await removeCowriterMembership(db, "p-sum", created.postWriterId);
    rows = await listActivePostWriters(db, "p-sum");
    expect(sumActiveShareBps(rows)).toBe(10_000);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("author");

    client.close();
  });
});

describe("co-writer publish gate", () => {
  beforeEach(() => {
    setCowritersEnabledForTests(true);
  });

  afterEach(() => {
    setCowritersEnabledForTests(undefined);
  });

  it("does not apply to solo posts", async () => {
    const { client, db } = await createMigratedDb();
    await db.insert(posts).values({
      id: "solo",
      slug: "solo",
      title: "Solo",
      status: "draft",
    });
    await db.insert(postWriters).values({
      id: "author:solo",
      postId: "solo",
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    const evaluation = await evaluateCowriterPublishGate(db, "solo");
    expect(evaluation.applies).toBe(false);
    expect(evaluation.blocked).toBe(false);
    await expect(assertCowriterPublishAllowed(db, "solo")).resolves.toBeUndefined();
    client.close();
  });

  it("blocks publish when co-writer is pending or split missing", async () => {
    const { client, db } = await createMigratedDb();
    const authorWallet = "0x1111111111111111111111111111111111111111";
    const cowriterWallet = "0x2222222222222222222222222222222222222222";

    await db.insert(authors).values({
      id: "a1",
      name: "Ada",
      slug: "ada",
      payoutAddress: authorWallet,
    });
    await db.insert(posts).values({
      id: "multi",
      slug: "multi",
      title: "Multi",
      status: "draft",
      authorId: "a1",
    });

    await db.insert(authors).values({
      id: "a2",
      name: "Co Author",
      slug: "co-author",
      payoutAddress: cowriterWallet,
    });

    await db.insert(postWriters).values([
      {
        id: "author:multi",
        postId: "multi",
        writerId: "a1",
        role: "author",
        shareBps: 5000,
        status: "accepted",
      },
      {
        id: "cw:multi",
        postId: "multi",
        writerId: "a2",
        role: "cowriter",
        shareBps: 5000,
        status: "pending",
      },
    ]);

    let evaluation = await evaluateCowriterPublishGate(db, "multi");
    expect(evaluation.blocked).toBe(true);
    await expect(assertCowriterPublishAllowed(db, "multi")).rejects.toBeInstanceOf(
      CowriterPublishBlockedError,
    );

    await db
      .update(postWriters)
      .set({ status: "accepted" })
      .where(eq(postWriters.id, "cw:multi"));

    evaluation = await evaluateCowriterPublishGate(db, "multi");
    expect(evaluation.blocked).toBe(true);

    const groupKey = computeWriterGroupKey([
      { wallet: authorWallet, shareBps: 5000 },
      { wallet: cowriterWallet, shareBps: 5000 },
    ]);
    await db.insert(writerGroupSplits).values({
      groupKey,
      splitAddress: "0xsplit",
      status: "deployed",
    });

    evaluation = await evaluateCowriterPublishGate(db, "multi");
    expect(evaluation.blocked).toBe(false);

    client.close();
  });

  it("is inactive when feature flag is off", async () => {
    setCowritersEnabledForTests(false);
    const { client, db } = await createMigratedDb();
    const evaluation = await evaluateCowriterPublishGate(db, "missing");
    expect(evaluation.applies).toBe(false);
    client.close();
  });
});
