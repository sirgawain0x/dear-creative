import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authors } from "@/db/schema";
import { createPostsTestDb, insertPost } from "@/lib/posts/test-support/posts-test-db";
import { writerHasGatedPosts } from "./writer-gated-posts";

async function insertAuthor(
  db: Awaited<ReturnType<typeof createPostsTestDb>>,
  authorId: string,
) {
  await db.insert(authors).values({
    id: authorId,
    name: "Writer",
    slug: `writer-${authorId.slice(0, 8)}`,
    payoutAddress: "0x0000000000000000000000000000000000000001",
  });
}

describe("writerHasGatedPosts", () => {
  it("returns false when the writer has no gated published posts", async () => {
    const db = await createPostsTestDb();
    const writerId = randomUUID();
    await insertAuthor(db, writerId);
    await insertPost(db, {
      slug: "free-only",
      title: "Free",
      status: "published",
      publishedAt: new Date(),
      isGated: false,
      authorId: writerId,
    });
    expect(await writerHasGatedPosts(db, writerId)).toBe(false);
  });

  it("returns true when the writer has a published gated post", async () => {
    const db = await createPostsTestDb();
    const writerId = randomUUID();
    await insertAuthor(db, writerId);
    await insertPost(db, {
      slug: "paid-post",
      title: "Paid",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
      authorId: writerId,
    });
    expect(await writerHasGatedPosts(db, writerId)).toBe(true);
  });

  it("ignores gated drafts and other writers", async () => {
    const db = await createPostsTestDb();
    const writerId = randomUUID();
    const otherWriter = randomUUID();
    await insertAuthor(db, writerId);
    await insertAuthor(db, otherWriter);
    await insertPost(db, {
      slug: "gated-draft",
      title: "Draft gated",
      status: "draft",
      publishedAt: null,
      isGated: true,
      authorId: writerId,
    });
    await insertPost(db, {
      slug: "other-writer-paid",
      title: "Other",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
      authorId: otherWriter,
    });
    expect(await writerHasGatedPosts(db, writerId)).toBe(false);
  });
});
