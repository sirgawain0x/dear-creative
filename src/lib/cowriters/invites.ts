import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { postWriters, writerInvites } from "@/db/schema";
import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TTL_MS,
} from "./invite-token";
import {
  assertCanAddCowriter,
  ensureAuthorPostWriterRow,
  findAuthorIdByPayoutAddress,
  listActivePostWriters,
  rebalancePostWriterShares,
} from "./membership";
import { normalizeEmail, normalizeWalletAddress } from "./wallet";

export type CreateCowriterInviteInput = {
  postId: string;
  invitedBy: string;
  email?: string;
  wallet?: string;
  inviteBaseUrl: string;
};

export type CreateCowriterInviteResult = {
  inviteId: string;
  postWriterId: string;
  inviteUrl: string;
  expiresAt: Date;
  matchedExistingWriter: boolean;
};

export async function createCowriterInvite(
  db: DearCreativeDb,
  input: CreateCowriterInviteInput,
): Promise<CreateCowriterInviteResult> {
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  const wallet = input.wallet?.trim()
    ? normalizeWalletAddress(input.wallet)
    : null;

  if (!email && !wallet) {
    throw new Error("Provide an email or wallet for the co-writer invite");
  }
  if (email && wallet) {
    throw new Error("Provide either email or wallet, not both");
  }

  await ensureAuthorPostWriterRow(db, input.postId);

  const active = await listActivePostWriters(db, input.postId);
  assertCanAddCowriter(active);

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const inviteId = randomUUID();
  const postWriterId = randomUUID();

  let matchedWriterId: string | null = null;
  if (wallet) {
    matchedWriterId = await findAuthorIdByPayoutAddress(db, wallet);
  }

  await db.insert(writerInvites).values({
    id: inviteId,
    postId: input.postId,
    invitedBy: input.invitedBy,
    email,
    wallet,
    tokenHash,
    expiresAt,
    status: "pending",
  });

  await db.insert(postWriters).values({
    id: postWriterId,
    postId: input.postId,
    writerId: matchedWriterId,
    inviteId,
    role: "cowriter",
    shareBps: 0,
    status: "pending",
  });

  await rebalancePostWriterShares(db, input.postId);

  const base = input.inviteBaseUrl.replace(/\/$/, "");
  const inviteUrl = `${base}/cowriters/accept?token=${encodeURIComponent(token)}`;

  return {
    inviteId,
    postWriterId,
    inviteUrl,
    expiresAt,
    matchedExistingWriter: Boolean(matchedWriterId),
  };
}

export async function removeCowriterMembership(
  db: DearCreativeDb,
  postId: string,
  postWriterId: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(postWriters)
    .where(and(eq(postWriters.id, postWriterId), eq(postWriters.postId, postId)))
    .limit(1);

  if (!row || row.role !== "cowriter") {
    return false;
  }

  await db
    .update(postWriters)
    .set({ status: "removed" })
    .where(eq(postWriters.id, postWriterId));

  if (row.inviteId) {
    await db
      .update(writerInvites)
      .set({ status: "revoked" })
      .where(eq(writerInvites.id, row.inviteId));
  }

  await rebalancePostWriterShares(db, postId);
  return true;
}

export async function findPendingInviteByToken(
  db: DearCreativeDb,
  token: string,
) {
  const tokenHash = hashInviteToken(token);
  const [invite] = await db
    .select()
    .from(writerInvites)
    .where(eq(writerInvites.tokenHash, tokenHash))
    .limit(1);
  if (!invite || invite.status !== "pending") {
    return null;
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return invite;
}
