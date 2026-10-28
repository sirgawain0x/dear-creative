import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { authors, postWriters, posts, writerInvites } from "@/db/schema";
import { isCowritersEnabled } from "./feature-flag";
import { formatWalletLabel } from "./wallet";

export type PostBylineWriter = {
  label: string;
  role: "author" | "cowriter";
};

export async function getAcceptedPostByline(
  db: DearCreativeDb,
  postId: string,
): Promise<PostBylineWriter[]> {
  if (!isCowritersEnabled()) {
    return [];
  }

  const rows = await db
    .select()
    .from(postWriters)
    .where(
      and(
        eq(postWriters.postId, postId),
        eq(postWriters.status, "accepted"),
      ),
    );

  if (rows.length === 0) {
    return [];
  }

  const [postRow] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  const byline: PostBylineWriter[] = [];
  const sorted = [...rows].sort((a, b) => {
    if (a.role === b.role) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.role === "author" ? -1 : 1;
  });

  for (const row of sorted) {
    let label = row.role === "author" ? "Author" : "Co-writer";
    const authorId =
      row.writerId ?? (row.role === "author" ? postRow?.authorId : null);

    if (authorId) {
      const [author] = await db
        .select({ name: authors.name })
        .from(authors)
        .where(eq(authors.id, authorId))
        .limit(1);
      if (author?.name) {
        label = author.name;
      }
    }

    if (row.inviteId && row.role === "cowriter" && !authorId) {
      const [invite] = await db
        .select({ email: writerInvites.email, wallet: writerInvites.wallet })
        .from(writerInvites)
        .where(eq(writerInvites.id, row.inviteId))
        .limit(1);
      if (invite?.email) {
        label = invite.email;
      } else if (invite?.wallet) {
        label = formatWalletLabel(invite.wallet);
      }
    }

    byline.push({ label, role: row.role });
  }

  return byline;
}

export async function getAcceptedPostBylineForSlug(
  db: DearCreativeDb,
  slug: string,
): Promise<PostBylineWriter[]> {
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.slug, slug))
    .limit(1);
  if (!post) {
    return [];
  }
  return getAcceptedPostByline(db, post.id);
}
