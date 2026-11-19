import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { deliverNewsletterEmailBestEffort } from "@/lib/adam/deliver-email";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { approvePost } from "@/lib/approval/approve-post";

export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ postId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { postId } = await context.params;
  const db = getDb();
  const result = await approvePost(db, postId, auth.actor);

  if (result === "not_found") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (result === "not_pending") {
    return NextResponse.json({ error: "Approval is not pending" }, { status: 409 });
  }
  if (result === "content_changed") {
    return NextResponse.json(
      { error: "Content changed since submission; approval voided" },
      { status: 409 },
    );
  }

  revalidateTag("posts-recent", "max");
  const emailDelivery = await deliverNewsletterEmailBestEffort(db, {
    postId,
    idempotencyKey: `approve:${postId}:email`,
    actor: auth.actor,
  });
  return NextResponse.json({ outcome: "approved", postId, emailDelivery });
}
