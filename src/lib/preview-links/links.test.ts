import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { posts, postPreviewLinks } from "@/db/schema";
import type { DearCreativeDb } from "@/db/client";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import {
  createPostPreviewLink,
  resolvePreviewLinkByToken,
  revokePostPreviewLink,
} from "./links";
import { hashPreviewLinkToken } from "./preview-token";

async function postIdForSlug(db: DearCreativeDb, slug: string): Promise<string> {
  const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
  if (!row) {
    throw new Error(`missing post ${slug}`);
  }
  return row.id;
}

describe("post preview links", () => {
  it("resolves a valid token", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-preview",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    const postId = await postIdForSlug(db, "draft-preview");

    const created = await createPostPreviewLink(db, {
      postId,
      createdBy: "did:privy:writer",
      siteOrigin: "https://dear.example.test",
    });

    const token = decodeURIComponent(created.previewUrl.split("/preview/")[1]!);
    const resolved = await resolvePreviewLinkByToken(db, token);
    expect(resolved).toEqual({ ok: true, postId, linkId: created.linkId });
  });

  it("rejects wrong tokens", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-one",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    const resolved = await resolvePreviewLinkByToken(db, "not-a-real-token");
    expect(resolved).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects expired tokens", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-expired",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    const postId = await postIdForSlug(db, "draft-expired");
    const token = "expired-preview-token";
    await db.insert(postPreviewLinks).values({
      id: randomUUID(),
      postId,
      tokenHash: hashPreviewLinkToken(token),
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      createdBy: "did:privy:writer",
    });
    const resolved = await resolvePreviewLinkByToken(db, token);
    expect(resolved).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects revoked tokens", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-revoked",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    const postId = await postIdForSlug(db, "draft-revoked");
    const token = "revoked-preview-token";
    await db.insert(postPreviewLinks).values({
      id: randomUUID(),
      postId,
      tokenHash: hashPreviewLinkToken(token),
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: new Date(),
      createdBy: "did:privy:writer",
    });
    const resolved = await resolvePreviewLinkByToken(db, token);
    expect(resolved).toEqual({ ok: false, reason: "revoked" });
  });

  it("revoke marks link inactive", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-revoke-flow",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    const postId = await postIdForSlug(db, "draft-revoke-flow");
    const created = await createPostPreviewLink(db, {
      postId,
      createdBy: "did:privy:admin",
      siteOrigin: "https://dear.example.test",
    });
    const ok = await revokePostPreviewLink(db, postId, created.linkId);
    expect(ok).toBe(true);
    const token = decodeURIComponent(created.previewUrl.split("/preview/")[1]!);
    const resolved = await resolvePreviewLinkByToken(db, token);
    expect(resolved).toEqual({ ok: false, reason: "revoked" });
  });
});
