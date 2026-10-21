import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { DearCreativeDb } from "@/db/client";
import { authors } from "@/db/schema";
import { getPrivyAdminUserIds } from "@/lib/privy/config";
import {
  requirePrivyAuth,
  type PrivyAuthResult,
} from "@/lib/privy/require-auth";
import { resolvePrivyLinkedChecksumWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { isAuthorProfilesEnabled } from "./feature-flag";

export type AuthorEditAuthResult =
  | { ok: true; privyUserId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse };

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export async function authorOwnsRecord(input: {
  db: DearCreativeDb;
  authorId: string;
  privyUserId: string;
  linkedWalletAddresses: string[];
}): Promise<boolean> {
  const adminIds = getPrivyAdminUserIds();
  if (adminIds.has(input.privyUserId)) {
    return true;
  }

  const [author] = await input.db
    .select({ payoutAddress: authors.payoutAddress })
    .from(authors)
    .where(eq(authors.id, input.authorId))
    .limit(1);

  if (!author) {
    return false;
  }

  const payout = normalizeAddress(author.payoutAddress);
  if (!payout) {
    return false;
  }

  return input.linkedWalletAddresses.some(
    (wallet) => normalizeAddress(wallet) === payout,
  );
}

export async function requireAuthorProfileEditAccess(
  request: Request,
  db: DearCreativeDb,
  authorId: string,
): Promise<AuthorEditAuthResult> {
  if (!isAuthorProfilesEnabled()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const privyResult: PrivyAuthResult = await requirePrivyAuth(request);
  if (!privyResult.ok) {
    return privyResult;
  }

  const adminIds = getPrivyAdminUserIds();
  const isAdmin = adminIds.has(privyResult.user.userId);

  if (isAdmin) {
    return { ok: true, privyUserId: privyResult.user.userId, isAdmin: true };
  }

  const wallets =
    (await resolvePrivyLinkedChecksumWalletAddresses(
      request.headers.get("authorization"),
    )) ?? [];

  const owns = await authorOwnsRecord({
    db,
    authorId,
    privyUserId: privyResult.user.userId,
    linkedWalletAddresses: wallets,
  });

  if (!owns) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    privyUserId: privyResult.user.userId,
    isAdmin: false,
  };
}
