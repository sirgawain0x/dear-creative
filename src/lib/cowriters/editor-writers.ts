import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { postWriters, writerInvites } from "@/db/schema";
import { evaluateCowriterPublishGate } from "./publish-gate";
import { resolveWriterPayoutInfos } from "./membership";

export type EditorWriterChip = {
  id: string;
  role: "author" | "cowriter";
  status: "pending" | "accepted" | "removed";
  shareBps: number;
  displayLabel: string;
  needsPayoutWallet: boolean;
  inviteId: string | null;
  inviteUrl?: string | null;
};

export type EditorWritersSnapshot = {
  writers: EditorWriterChip[];
  publishGate: Awaited<ReturnType<typeof evaluateCowriterPublishGate>>;
};

export async function getEditorWritersSnapshot(
  db: DearCreativeDb,
  postId: string,
): Promise<EditorWritersSnapshot> {
  const rows = await db
    .select()
    .from(postWriters)
    .where(eq(postWriters.postId, postId));

  const payoutInfos = await resolveWriterPayoutInfos(db, postId);
  const payoutByMembership = new Map(
    payoutInfos.map((info) => [info.postWriterId, info]),
  );

  const writers: EditorWriterChip[] = [];
  for (const row of rows) {
    if (row.status === "removed") {
      continue;
    }
    const payout = payoutByMembership.get(row.id);
    writers.push({
      id: row.id,
      role: row.role,
      status: row.status,
      shareBps: row.shareBps,
      displayLabel: payout?.displayLabel ?? row.role,
      needsPayoutWallet: !payout?.payoutWallet?.trim(),
      inviteId: row.inviteId,
    });
  }

  writers.sort((a, b) => {
    if (a.role === b.role) {
      return a.displayLabel.localeCompare(b.displayLabel);
    }
    return a.role === "author" ? -1 : 1;
  });

  const publishGate = await evaluateCowriterPublishGate(db, postId);

  return { writers, publishGate };
}

export async function getInviteMetaForMembership(
  db: DearCreativeDb,
  inviteId: string,
) {
  const [invite] = await db
    .select({
      id: writerInvites.id,
      status: writerInvites.status,
      email: writerInvites.email,
      wallet: writerInvites.wallet,
      expiresAt: writerInvites.expiresAt,
    })
    .from(writerInvites)
    .where(eq(writerInvites.id, inviteId))
    .limit(1);
  return invite ?? null;
}

export async function countActiveCowritersForPost(
  db: DearCreativeDb,
  postId: string,
): Promise<number> {
  const rows = await db
    .select({ id: postWriters.id })
    .from(postWriters)
    .where(
      and(
        eq(postWriters.postId, postId),
        eq(postWriters.role, "cowriter"),
      ),
    );
  return rows.filter((row) => row.id).length;
}
