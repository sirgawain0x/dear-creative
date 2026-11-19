import { and, desc, eq, notInArray } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import {
  approvals,
  deliveryReceipts,
  posts,
  type DeliveryReceiptStatus,
} from "@/db/schema";

export type ApprovalQueueItem = {
  postId: string;
  slug: string;
  title: string;
  status: string;
  postStatus: string;
  teaserText: string | null;
  emailSubject: string | null;
  emailHtml: string | null;
  bodyHtml: string | null;
  contentHash: string;
  createdAt: string;
  emailDeliveryStatus: DeliveryReceiptStatus | null;
  emailDeliveredAt: string | null;
  emailDeliveryError: string | null;
};

export async function listApprovalQueue(
  db: DearCreativeDb,
): Promise<ApprovalQueueItem[]> {
  const rows = await db
    .select({
      postId: approvals.postId,
      slug: posts.slug,
      title: posts.title,
      status: approvals.status,
      postStatus: posts.status,
      teaserText: posts.teaserText,
      emailSubject: posts.emailSubject,
      emailHtml: posts.emailHtml,
      bodyHtml: posts.bodyHtml,
      contentHash: approvals.contentHash,
      createdAt: approvals.createdAt,
      emailDeliveryStatus: deliveryReceipts.status,
      emailCompletedAt: deliveryReceipts.completedAt,
      emailDeliveryError: deliveryReceipts.lastError,
    })
    .from(approvals)
    .innerJoin(posts, eq(approvals.postId, posts.id))
    .leftJoin(
      deliveryReceipts,
      and(
        eq(deliveryReceipts.postId, approvals.postId),
        eq(deliveryReceipts.channel, "email"),
      ),
    )
    .where(notInArray(posts.status, ["deleted", "scheduled"]))
    .orderBy(desc(approvals.createdAt));

  return rows.map((row) => ({
    postId: row.postId,
    slug: row.slug,
    title: row.title,
    status: row.status,
    postStatus: row.postStatus,
    teaserText: row.teaserText,
    emailSubject: row.emailSubject,
    emailHtml: row.emailHtml,
    bodyHtml: row.bodyHtml,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    emailDeliveryStatus: row.emailDeliveryStatus ?? null,
    emailDeliveredAt:
      row.emailDeliveryStatus === "completed" && row.emailCompletedAt
        ? row.emailCompletedAt.toISOString()
        : null,
    emailDeliveryError: row.emailDeliveryError ?? null,
  }));
}
