import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { authors } from "@/db/schema";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { isAuthorProfilesEnabled } from "./feature-flag";

export type AuthorEditAuthResult =
  | { ok: true; privyUserId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse };

function normalizeWallet(value: string): string {
  return value.trim().toLowerCase();
}

async function writerOwnsAuthorProfile(
  privyUserId: string,
  authorId: string,
): Promise<boolean> {
  const db = getDb();
  const [author] = await db
    .select({ payoutAddress: authors.payoutAddress })
    .from(authors)
    .where(eq(authors.id, authorId))
    .limit(1);
  if (!author?.payoutAddress?.trim()) {
    return false;
  }
  const linkedWallets =
    (await resolvePrivyLinkedChecksumWalletAddresses(privyUserId)) ?? [];
  const payout = normalizeWallet(author.payoutAddress);
  return linkedWallets.some((wallet) => normalizeWallet(wallet) === payout);
}

/**
 * Profile edit APIs: Privy admin or the writer whose linked wallet matches
 * `authors.payout_address` for the target author id.
 */
export async function requireAuthorProfileEditAccess(
  request: Request,
  authorId: string,
): Promise<AuthorEditAuthResult> {
  if (!isAuthorProfilesEnabled()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const adminResult = await requirePrivyAuth(request, { requireAdmin: true });
  if (adminResult.ok) {
    return {
      ok: true,
      privyUserId: adminResult.user.userId,
      isAdmin: true,
    };
  }

  const writerResult = await requirePrivyAuth(request);
  if (!writerResult.ok) {
    return writerResult;
  }

  const ownsProfile = await writerOwnsAuthorProfile(
    writerResult.user.userId,
    authorId,
  );
  if (!ownsProfile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    privyUserId: writerResult.user.userId,
    isAdmin: false,
  };
}
