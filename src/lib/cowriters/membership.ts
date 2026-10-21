import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import {
  authors,
  postWriters,
  posts,
  writerInvites,
} from "@/db/schema";
import { MAX_COWRITERS_PER_POST } from "./constants";
import { equalWriterShareBps } from "./share-math";
import { formatWalletLabel, normalizeWalletAddress } from "./wallet";

export type ActivePostWriterRow = typeof postWriters.$inferSelect;

/** Backfill author membership for posts created after migration 0021. */
export async function ensureAuthorPostWriterRow(
  db: DearCreativeDb,
  postId: string,
): Promise<void> {
  const [postRow] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!postRow) {
    throw new Error("Post not found");
  }

  await db
    .insert(postWriters)
    .values({
      id: `author:${postId}`,
      postId,
      writerId: postRow.authorId,
      inviteId: null,
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    })
    .onConflictDoNothing();
}

export async function listActivePostWriters(
  db: DearCreativeDb,
  postId: string,
): Promise<ActivePostWriterRow[]> {
  const rows = await db
    .select()
    .from(postWriters)
    .where(
      and(eq(postWriters.postId, postId), ne(postWriters.status, "removed")),
    );
  return rows;
}

export function countActiveCowriters(
  rows: Pick<ActivePostWriterRow, "role">[],
): number {
  return rows.filter((row) => row.role === "cowriter").length;
}

export function assertCanAddCowriter(
  rows: Pick<ActivePostWriterRow, "role">[],
): void {
  if (countActiveCowriters(rows) >= MAX_COWRITERS_PER_POST) {
    throw new Error(
      `At most ${MAX_COWRITERS_PER_POST} co-writers allowed per post`,
    );
  }
}

export async function findAuthorIdByPayoutAddress(
  db: DearCreativeDb,
  wallet: string,
): Promise<string | null> {
  const normalized = normalizeWalletAddress(wallet);
  const [row] = await db
    .select({ id: authors.id })
    .from(authors)
    .where(sql`lower(${authors.payoutAddress}) = ${normalized}`)
    .limit(1);
  return row?.id ?? null;
}

export async function ensureAuthorForPayoutAddress(
  db: DearCreativeDb,
  wallet: string,
  displayName?: string,
): Promise<string> {
  const existing = await findAuthorIdByPayoutAddress(db, wallet);
  if (existing) {
    return existing;
  }
  const normalized = normalizeWalletAddress(wallet);
  const authorId = randomUUID();
  await db.insert(authors).values({
    id: authorId,
    name: displayName ?? formatWalletLabel(normalized),
    slug: `cowriter-${authorId.slice(0, 8)}`,
    payoutAddress: normalized,
  });
  return authorId;
}

export async function rebalancePostWriterShares(
  db: DearCreativeDb,
  postId: string,
): Promise<void> {
  const rows = await listActivePostWriters(db, postId);
  if (rows.length === 0) {
    return;
  }
  const shares = equalWriterShareBps(rows.length);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const shareBps = shares[i]!;
    if (row.shareBps !== shareBps) {
      await db
        .update(postWriters)
        .set({ shareBps })
        .where(eq(postWriters.id, row.id));
    }
  }
}

export async function postUsesCowriterFlow(
  db: DearCreativeDb,
  postId: string,
): Promise<boolean> {
  const rows = await listActivePostWriters(db, postId);
  if (rows.some((row) => row.role === "cowriter")) {
    return true;
  }
  const pendingInvites = await db
    .select({ id: writerInvites.id })
    .from(writerInvites)
    .where(
      and(eq(writerInvites.postId, postId), eq(writerInvites.status, "pending")),
    )
    .limit(1);
  return pendingInvites.length > 0;
}

export type WriterPayoutInfo = {
  postWriterId: string;
  role: "author" | "cowriter";
  writerId: string | null;
  shareBps: number;
  payoutWallet: string | null;
  displayLabel: string;
};

async function loadAuthorById(db: DearCreativeDb, authorId: string) {
  const [author] = await db
    .select({
      name: authors.name,
      payoutAddress: authors.payoutAddress,
    })
    .from(authors)
    .where(eq(authors.id, authorId))
    .limit(1);
  return author ?? null;
}

export async function resolveWriterPayoutInfos(
  db: DearCreativeDb,
  postId: string,
): Promise<WriterPayoutInfo[]> {
  const rows = await listActivePostWriters(db, postId);
  const [postRow] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  const infos: WriterPayoutInfo[] = [];
  for (const row of rows) {
    let payoutWallet: string | null = null;
    let displayLabel = row.role === "author" ? "Author" : "Co-writer";

    const authorId = row.writerId ?? (row.role === "author" ? postRow?.authorId : null);
    if (authorId) {
      const author = await loadAuthorById(db, authorId);
      if (author) {
        payoutWallet = author.payoutAddress;
        displayLabel = author.name;
      }
    }

    if (row.inviteId && row.role === "cowriter" && !row.writerId) {
      const [invite] = await db
        .select({ email: writerInvites.email, wallet: writerInvites.wallet })
        .from(writerInvites)
        .where(eq(writerInvites.id, row.inviteId))
        .limit(1);
      if (invite?.email) {
        displayLabel = invite.email;
      } else if (invite?.wallet) {
        displayLabel = formatWalletLabel(invite.wallet);
      }
    }

    infos.push({
      postWriterId: row.id,
      role: row.role,
      writerId: row.writerId,
      shareBps: row.shareBps,
      payoutWallet,
      displayLabel,
    });
  }

  return infos;
}
