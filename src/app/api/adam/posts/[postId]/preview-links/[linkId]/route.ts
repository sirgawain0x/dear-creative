import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { requirePreviewLinksEnabled } from "@/lib/preview-links/api-guard";
import { revokePostPreviewLink } from "@/lib/preview-links/links";
import { requirePostPreviewLinkManageAccess } from "@/lib/preview-links/manage-access";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";

type RouteContext = {
  params: Promise<{ postId: string; linkId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const disabled = requirePreviewLinksEnabled();
  if (disabled) {
    return disabled;
  }

  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { postId, linkId } = await context.params;
  const post = await getAdminPostByIdOrSlug(getDb(), postId);
  if (!post || post.id.startsWith("content:")) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const forbidden = await requirePostPreviewLinkManageAccess(
    getDb(),
    post.id,
    auth,
  );
  if (forbidden) {
    return forbidden;
  }

  const revoked = await revokePostPreviewLink(getDb(), post.id, linkId);
  if (!revoked) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
