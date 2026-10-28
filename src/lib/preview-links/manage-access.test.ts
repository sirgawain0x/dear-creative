import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { authors, posts, postWriters } from "@/db/schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { canManagePostPreviewLinks } from "./manage-access";

describe("canManagePostPreviewLinks", () => {
  it("allows admins and post authors, not other writers", async () => {
    const db = await createPostsTestDb();
    const authorId = "did:privy:author-a";
    const otherWriter = "did:privy:author-b";

    await db.insert(authors).values({
      id: authorId,
      name: "Author A",
      slug: "author-a",
      payoutAddress: "0x0000000000000000000000000000000000000001",
    });

    await insertPost(db, {
      slug: "owned-draft",
      title: "Owned",
      status: "draft",
      publishedAt: null,
      authorId,
    });

    const [postRow] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, "owned-draft"))
      .limit(1);

    await db.insert(postWriters).values({
      id: `author:${postRow!.id}`,
      postId: postRow!.id,
      writerId: authorId,
      inviteId: null,
      role: "author",
      shareBps: 10_000,
      status: "accepted",
    });

    vi.stubEnv("PRIVY_ADMIN_USER_IDS", "did:privy:admin");

    await expect(
      canManagePostPreviewLinks(db, postRow!.id, {
        ok: true,
        actor: "did:privy:admin",
        mode: "privy_admin",
      }),
    ).resolves.toBe(true);

    await expect(
      canManagePostPreviewLinks(db, postRow!.id, {
        ok: true,
        actor: authorId,
        mode: "privy_admin",
      }),
    ).resolves.toBe(true);

    await expect(
      canManagePostPreviewLinks(db, postRow!.id, {
        ok: true,
        actor: otherWriter,
        mode: "privy_admin",
      }),
    ).resolves.toBe(false);

    vi.unstubAllEnvs();
  });
});
