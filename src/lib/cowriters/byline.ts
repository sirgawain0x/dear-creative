import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { authors, postWriters, posts, writerInvites, writers } from "@/db/schema";
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
    .select({ authorId: posts.authorId, title: posts.title })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  let authorName: string | null = null;
  if (postRow?.authorId) {
    const [author] = await db
      .select({ name: authors.name })
      .from(authors)
      .where(eq(authors.id, postRow.authorId))
      .limit(1);
    authorName = author?.name ?? null;
  }

  const byline: PostBylineWriter[] = [];
  const sorted = [...rows].sort((a, b) => {
    if (a.role === b.role) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.role === "author" ? -1 : 1;
  });

  for (const row of sorted) {
    let label =
      row.role === "author" ? authorName ?? "Author" : "Co-writer";

    if (row.writerId) {
      const [writer] = await db
        .select({ payoutWalletAddress: writers.payoutWalletAddress })
        .from(writers)
        .where(eq(writers.id, row.writerId))
        .limit(1);
      if (row.role === "cowriter" && writer?.payoutWalletAddress) {
        label = formatWalletLabel(writer.payoutWalletAddress);
      }
    }

    if (row.inviteId) {
      const [invite] = await db
        .select({ email: writerInvites.email, wallet: writerInvites.wallet })
        .from(writerInvites)
        .where(eq(writerInvites.id, row.inviteId))
        .limit(1);
      if (invite?.email) {
        label = invite.email;
      } else if (invite?.wallet && row.role === "cowriter") {
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
