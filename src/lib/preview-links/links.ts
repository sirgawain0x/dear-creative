import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { postPreviewLinks } from "@/db/schema";
import {
  generatePreviewLinkToken,
  hashPreviewLinkToken,
  PREVIEW_LINK_TTL_MS,
} from "./preview-token";

export type ActivePreviewLinkSummary = {
  id: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
};

export type CreatePreviewLinkResult = {
  linkId: string;
  previewUrl: string;
  expiresAt: Date;
};

export function buildPreviewLinkUrl(siteOrigin: string, token: string): string {
  const base = siteOrigin.replace(/\/$/, "");
  return `${base}/preview/${encodeURIComponent(token)}`;
}

export async function listActivePostPreviewLinks(
  db: DearCreativeDb,
  postId: string,
): Promise<ActivePreviewLinkSummary[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(postPreviewLinks)
    .where(
      and(
        eq(postPreviewLinks.postId, postId),
        isNull(postPreviewLinks.revokedAt),
        gt(postPreviewLinks.expiresAt, now),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  }));
}

export async function createPostPreviewLink(
  db: DearCreativeDb,
  input: {
    postId: string;
    createdBy: string;
    siteOrigin: string;
  },
): Promise<CreatePreviewLinkResult> {
  const token = generatePreviewLinkToken();
  const tokenHash = hashPreviewLinkToken(token);
  const expiresAt = new Date(Date.now() + PREVIEW_LINK_TTL_MS);
  const linkId = randomUUID();

  await db.insert(postPreviewLinks).values({
    id: linkId,
    postId: input.postId,
    tokenHash,
    expiresAt,
    revokedAt: null,
    createdBy: input.createdBy,
  });

  return {
    linkId,
    previewUrl: buildPreviewLinkUrl(input.siteOrigin, token),
    expiresAt,
  };
}

export async function revokePostPreviewLink(
  db: DearCreativeDb,
  postId: string,
  linkId: string,
): Promise<boolean> {
  const [active] = await db
    .select({ id: postPreviewLinks.id })
    .from(postPreviewLinks)
    .where(
      and(
        eq(postPreviewLinks.id, linkId),
        eq(postPreviewLinks.postId, postId),
        isNull(postPreviewLinks.revokedAt),
      ),
    )
    .limit(1);
  if (!active) {
    return false;
  }

  const now = new Date();
  await db
    .update(postPreviewLinks)
    .set({ revokedAt: now })
    .where(
      and(
        eq(postPreviewLinks.id, linkId),
        eq(postPreviewLinks.postId, postId),
        isNull(postPreviewLinks.revokedAt),
      ),
    );
  return true;
}

export type ResolvePreviewLinkResult =
  | { ok: true; postId: string; linkId: string }
  | { ok: false; reason: "invalid" | "expired" | "revoked" };

export async function resolvePreviewLinkByToken(
  db: DearCreativeDb,
  token: string,
): Promise<ResolvePreviewLinkResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid" };
  }

  const tokenHash = hashPreviewLinkToken(trimmed);
  const [row] = await db
    .select()
    .from(postPreviewLinks)
    .where(eq(postPreviewLinks.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "invalid" };
  }
  if (row.revokedAt) {
    return { ok: false, reason: "revoked" };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, postId: row.postId, linkId: row.id };
}
