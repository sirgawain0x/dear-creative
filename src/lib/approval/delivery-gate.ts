import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { corePostColumns, ensurePostsSchema } from "@/db/ensure-schema";
import {
  approvals,
  deliveryChannelEnum,
  deliveryReceipts,
  posts,
  type DeliveryChannel,
} from "@/db/schema";
import { contentHashForPost } from "./snapshot-from-post";

const APPROVAL_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type DeliveryGateFailure =
  | "not_found"
  | "not_approved"
  | "content_changed"
  | "approval_expired"
  | "already_delivered"
  | "imported_archive";

export type DeliveryGatePost = {
  id: string;
  slug: string;
  title: string;
  teaserText: string | null;
  emailSubject: string | null;
  emailHtml: string | null;
  bodyHtml: string | null;
  sponsorId: string | null;
};

export type DeliveryGateSuccess = {
  post: DeliveryGatePost;
  approvalId: string;
};

export async function assertDeliverable(
  db: DearCreativeDb,
  postId: string,
  channel: DeliveryChannel,
  now = new Date(),
): Promise<
  | { ok: true; value: DeliveryGateSuccess }
  | { ok: false; reason: DeliveryGateFailure }
> {
  await ensurePostsSchema(db);
  const postRows = await db
    .select(corePostColumns)
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  const post = postRows[0];
  if (!post || post.status === "deleted") {
    return { ok: false, reason: "not_found" };
  }
  if (!deliveryChannelEnum.includes(channel)) {
    return { ok: false, reason: "not_found" };
  }

  const completedRows = await db
    .select({ id: deliveryReceipts.id })
    .from(deliveryReceipts)
    .where(
      and(
        eq(deliveryReceipts.postId, postId),
        eq(deliveryReceipts.channel, channel),
        eq(deliveryReceipts.status, "completed"),
      ),
    )
    .limit(1);
  if (completedRows[0]) {
    return { ok: false, reason: "already_delivered" };
  }

  if (post.status === "scheduled") {
    return { ok: false, reason: "not_approved" };
  }

  if (post.source === "paragraph" || post.source === "beehiiv") {
    return { ok: false, reason: "imported_archive" };
  }

  const approvalRows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.postId, postId))
    .limit(1);
  const approval = approvalRows[0];
  if (!approval || approval.status !== "approved" || !approval.approvedAt) {
    return { ok: false, reason: "not_approved" };
  }

  if (contentHashForPost(post) !== approval.contentHash) {
    return { ok: false, reason: "content_changed" };
  }

  if (now.getTime() - approval.approvedAt.getTime() > APPROVAL_MAX_AGE_MS) {
    return { ok: false, reason: "approval_expired" };
  }

  return { ok: true, value: { post, approvalId: approval.id } };
}
