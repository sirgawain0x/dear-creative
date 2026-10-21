import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { posts } from "@/db/schema";
import { publishedVisibilityFilter } from "@/lib/posts/published-posts";

/** True when the writer has at least one published gated post (subscribe offer eligibility). */
export async function writerHasGatedPosts(
  db: DearCreativeDb,
  writerId: string,
): Promise<boolean> {
  const id = writerId.trim();
  if (!id) {
    return false;
  }

  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        publishedVisibilityFilter(),
        eq(posts.authorId, id),
        eq(posts.isGated, true),
      ),
    )
    .limit(1);

  return Boolean(row);
}
