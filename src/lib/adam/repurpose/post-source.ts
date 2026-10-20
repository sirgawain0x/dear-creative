import { eq, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { ensurePostsSchema } from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";
import { stripHtmlTags } from "@/lib/posts/reading-time";

export class RepurposePostError extends Error {
  constructor(
    readonly code: "not_found" | "ineligible",
    message: string,
  ) {
    super(message);
    this.name = "RepurposePostError";
  }
}

export type RepurposePostSource = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  authorId: string | null;
  teaserText: string | null;
  plainText: string;
};

async function loadPostAuthorId(
  db: DearCreativeDb,
  postId: string,
): Promise<string | null> {
  await ensurePostsSchema(db);
  try {
    const rows = await db.all<{ author_id?: string | null }>(
      sql`SELECT author_id FROM posts WHERE id = ${postId} LIMIT 1`,
    );
    return rows[0]?.author_id ?? null;
  } catch {
    return null;
  }
}

export async function loadRepurposePostSource(
  db: DearCreativeDb,
  postIdOrSlug: string,
): Promise<RepurposePostSource> {
  const post = await getAdminPostByIdOrSlug(db, postIdOrSlug);
  if (!post || post.id.startsWith("content:")) {
    throw new RepurposePostError(
      "not_found",
      "Post not found (save the post to the database first).",
    );
  }
  if (post.status !== "published" && post.status !== "draft") {
    throw new RepurposePostError(
      "ineligible",
      "Only published or draft posts can be repurposed.",
    );
  }

  const body = stripHtmlTags(post.bodyHtml ?? post.emailHtml ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const teaser = post.teaserText?.trim() ?? "";
  const plainText = [post.title.trim(), teaser, body].filter(Boolean).join("\n\n");

  if (!plainText.trim()) {
    throw new RepurposePostError("ineligible", "Post has no text content to repurpose.");
  }

  const authorId = await loadPostAuthorId(db, post.id);

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    status: post.status,
    authorId,
    teaserText: post.teaserText ?? null,
    plainText,
  };
}

/** @internal tests — set author_id on a post row */
export async function setPostAuthorIdForTests(
  db: DearCreativeDb,
  postId: string,
  authorId: string | null,
): Promise<void> {
  await ensurePostsSchema(db);
  await db
    .update(posts)
    .set({ authorId })
    .where(eq(posts.id, postId));
}
