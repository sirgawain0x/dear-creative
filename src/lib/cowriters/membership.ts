import { and, eq, ne } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import {
  authors,
  postWriters,
  posts,
  writerInvites,
  writers,
} from "@/db/schema";
import { MAX_COWRITERS_PER_POST } from "./constants";
import { equalWriterShareBps } from "./share-math";

export type ActivePostWriterRow = typeof postWriters.$inferSelect;

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

export async function findWriterIdByWallet(
  db: DearCreativeDb,
  wallet: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: writers.id })
    .from(writers)
    .where(eq(writers.payoutWalletAddress, wallet))
    .limit(1);
  return row?.id ?? null;
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

  let authorName: string | null = null;
  if (postRow?.authorId) {
    const [author] = await db
      .select({ name: authors.name, payoutAddress: authors.payoutAddress })
      .from(authors)
      .where(eq(authors.id, postRow.authorId))
      .limit(1);
    authorName = author?.name ?? null;
  }

  const infos: WriterPayoutInfo[] = [];
  for (const row of rows) {
    let payoutWallet: string | null = null;
    let displayLabel = row.role === "author" ? authorName ?? "Author" : "Co-writer";

    if (row.writerId) {
      const [writer] = await db
        .select({
          payoutWalletAddress: writers.payoutWalletAddress,
        })
        .from(writers)
        .where(eq(writers.id, row.writerId))
        .limit(1);
      payoutWallet = writer?.payoutWalletAddress ?? null;
      if (row.role === "cowriter" && payoutWallet) {
        displayLabel = payoutWallet;
      }
    } else if (row.role === "author" && postRow?.authorId) {
      const [author] = await db
        .select({ payoutAddress: authors.payoutAddress })
        .from(authors)
        .where(eq(authors.id, postRow.authorId))
        .limit(1);
      payoutWallet = author?.payoutAddress ?? null;
    }

    if (row.inviteId && row.role === "cowriter") {
      const [invite] = await db
        .select({ email: writerInvites.email, wallet: writerInvites.wallet })
        .from(writerInvites)
        .where(eq(writerInvites.id, row.inviteId))
        .limit(1);
      if (invite?.email) {
        displayLabel = invite.email;
      } else if (invite?.wallet) {
        displayLabel = invite.wallet;
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
