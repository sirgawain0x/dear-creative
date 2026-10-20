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
  writers,
} from "@/db/schema";
import { acceptCowriterInvite } from "./accept-invite";
import {
  setCowritersEnabledForTests,
} from "./feature-flag";
import { createCowriterInvite } from "./invites";
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

    const writerId = "w-cw";
    await db.insert(writers).values({
      id: writerId,
      payoutWalletAddress: cowriterWallet,
    });

    await db.insert(postWriters).values([
      {
        id: "author:multi",
        postId: "multi",
        role: "author",
        shareBps: 5000,
        status: "accepted",
      },
      {
        id: "cw:multi",
        postId: "multi",
        writerId,
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
