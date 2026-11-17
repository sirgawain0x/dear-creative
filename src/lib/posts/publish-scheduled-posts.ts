import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { corePostColumns, ensurePostsSchema } from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import { maybeSchedulePublishedPostNarrationRegeneration } from "@/lib/audio/schedule-narration-regeneration";
import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import { assertCowriterPublishAllowed, CowriterPublishBlockedError } from "@/lib/cowriters/publish-gate";

export async function publishScheduledPosts(db: DearCreativeDb, now = new Date()) {
  await ensurePostsSchema(db);
  const due = await db.select({
    id: posts.id,
    updatedAt: posts.updatedAt,
  })
    .from(posts)
    .where(and(eq(posts.status, "scheduled"), lte(posts.publishedAt, now)))
    .orderBy(asc(posts.publishedAt))
    .limit(100);

  const published: string[] = [];
  const blocked: string[] = [];
  for (const post of due) {
    try {
      await assertCowriterPublishAllowed(db, post.id);
    } catch (error) {
      if (!(error instanceof CowriterPublishBlockedError)) throw error;
      blocked.push(post.id);
      continue;
    }
    const publishedPost = await db.transaction(async (tx) => {
      const [row] = await tx.update(posts)
        .set({
          status: "published",
          bodyHtml: sql`coalesce(${posts.bodyHtml}, ${posts.emailHtml})`,
          updatedAt: now,
        })
        .where(and(
          eq(posts.id, post.id),
          eq(posts.status, "scheduled"),
          eq(posts.updatedAt, post.updatedAt),
          lte(posts.publishedAt, now),
        ))
        .returning({ ...corePostColumns, audioUrl: posts.audioUrl });
      if (!row) return null;

      await writeAuditEvent(tx, {
        actor: "adam-scheduler",
        action: "post.published_from_schedule",
        entityType: "post",
        entityId: post.id,
        payload: { slug: row.slug, publishedAt: row.publishedAt },
      });
      return row;
    });
    if (!publishedPost) continue;
    published.push(publishedPost.slug);
    if (!publishedPost.audioUrl) {
      maybeSchedulePublishedPostNarrationRegeneration({
        db,
        postId: post.id,
        existing: { ...publishedPost, status: "scheduled" },
        nextStatus: "published",
        nextTitle: publishedPost.title,
        nextTeaserText: publishedPost.teaserText,
        nextBodyHtml: publishedPost.bodyHtml,
        explicitAudioUpdate: false,
        actor: "adam-scheduler",
      });
    }
  }
  return { published, blocked };
}
