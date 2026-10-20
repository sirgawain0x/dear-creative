import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { authors, posts } from "@/db/schema";
import { createPostsTestDb, insertPost } from "./test-support/posts-test-db";
import { getAuthorBySlug } from "./post-author";
import { getPublishedPostBySlug } from "./published-posts";

describe("post author loading", () => {
  it("loads me_token columns via getAuthorBySlug", async () => {
    const db = await createPostsTestDb();
    const authorId = randomUUID();

    await db.insert(authors).values({
      id: authorId,
      name: "Token Author",
      slug: "token-author",
      bio: "Onchain essays",
      payoutAddress: "0x0000000000000000000000000000000000000001",
      meTokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      meTokenSymbol: "CRTVAI",
    });

    const author = await getAuthorBySlug(db, "token-author");
    expect(author?.meTokenAddress).toContain("abcdef");
    expect(author?.meTokenSymbol).toBe("CRTVAI");
  });

  it("joins author me_token fields on published post detail", async () => {
    const db = await createPostsTestDb();
    const authorId = randomUUID();
    const slug = "author-byline-post";

    await db.insert(authors).values({
      id: authorId,
      name: "Byline Author",
      slug: "byline-author",
      bio: null,
      payoutAddress: "0x0000000000000000000000000000000000000001",
      meTokenAddress: null,
      meTokenSymbol: null,
    });

    await insertPost(db, {
      slug,
      title: "Post With Author",
      status: "published",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await db
      .update(posts)
      .set({ authorId })
      .where(eq(posts.slug, slug));

    const post = await getPublishedPostBySlug(db, slug);
    expect(post?.author?.name).toBe("Byline Author");
    expect(post?.author?.meTokenAddress).toBeNull();
  });
});
