import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { postWriters, writerInvites, writers } from "@/db/schema";
import { findPendingInviteByToken } from "./invites";
import { rebalancePostWriterShares } from "./membership";
import { normalizeEmail, normalizeWalletAddress } from "./wallet";

export type CowriterAcceptIdentity = {
  emails: string[];
  wallets: string[];
};

export type AcceptCowriterInviteResult =
  | { ok: true; postId: string; writerId: string }
  | { ok: false; reason: "invalid_token" | "identity_mismatch" | "already_used" };

function normalizeIdentityList(values: string[], kind: "email" | "wallet"): string[] {
  const out = new Set<string>();
  for (const raw of values) {
    try {
      out.add(
        kind === "email" ? normalizeEmail(raw) : normalizeWalletAddress(raw),
      );
    } catch {
      // skip invalid entries from Privy profile
    }
  }
  return [...out];
}

function inviteMatchesIdentity(
  invite: typeof writerInvites.$inferSelect,
  identity: CowriterAcceptIdentity,
): boolean {
  const emails = normalizeIdentityList(identity.emails, "email");
  const wallets = normalizeIdentityList(identity.wallets, "wallet");

  if (invite.email) {
    return emails.includes(invite.email);
  }
  if (invite.wallet) {
    return wallets.includes(invite.wallet);
  }
  return false;
}

async function ensureWriterForWallet(
  db: DearCreativeDb,
  wallet: string,
): Promise<string> {
  const normalized = normalizeWalletAddress(wallet);
  const [existing] = await db
    .select({ id: writers.id })
    .from(writers)
    .where(eq(writers.payoutWalletAddress, normalized))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const writerId = randomUUID();
  await db.insert(writers).values({
    id: writerId,
    payoutWalletAddress: normalized,
  });
  return writerId;
}

export async function acceptCowriterInvite(
  db: DearCreativeDb,
  token: string,
  identity: CowriterAcceptIdentity,
): Promise<AcceptCowriterInviteResult> {
  const invite = await findPendingInviteByToken(db, token);
  if (!invite) {
    return { ok: false, reason: "invalid_token" };
  }

  if (!inviteMatchesIdentity(invite, identity)) {
    return { ok: false, reason: "identity_mismatch" };
  }

  const [membership] = await db
    .select()
    .from(postWriters)
    .where(
      and(
        eq(postWriters.postId, invite.postId),
        eq(postWriters.inviteId, invite.id),
      ),
    )
    .limit(1);

  if (!membership || membership.status === "accepted") {
    return { ok: false, reason: "already_used" };
  }

  let writerId = membership.writerId;
  if (!writerId) {
    const walletFromInvite = invite.wallet;
    const walletFromUser = normalizeIdentityList(identity.wallets, "wallet")[0];
    const wallet = walletFromInvite ?? walletFromUser;
    if (wallet) {
      writerId = await ensureWriterForWallet(db, wallet);
    } else {
      writerId = randomUUID();
      await db.insert(writers).values({ id: writerId });
    }
  }

  await db
    .update(writerInvites)
    .set({
      status: "accepted",
      acceptedWriterId: writerId,
    })
    .where(eq(writerInvites.id, invite.id));

  await db
    .update(postWriters)
    .set({
      status: "accepted",
      writerId,
    })
    .where(eq(postWriters.id, membership.id));

  await rebalancePostWriterShares(db, invite.postId);

  return { ok: true, postId: invite.postId, writerId };
}
