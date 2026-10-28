import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { requirePreviewLinksEnabled } from "@/lib/preview-links/api-guard";
import {
  createPostPreviewLink,
  listActivePostPreviewLinks,
} from "@/lib/preview-links/links";
import { requirePostPreviewLinkManageAccess } from "@/lib/preview-links/manage-access";
import { canCreatePostPreviewLink } from "@/lib/preview-links/post-eligibility";
import { getPublicSiteOrigin } from "@/lib/posts/recent-feed";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const disabled = requirePreviewLinksEnabled();
  if (disabled) {
    return disabled;
  }

  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { postId } = await context.params;
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

  const links = await listActivePostPreviewLinks(getDb(), post.id);
  return NextResponse.json({ links });
}

export async function POST(request: Request, context: RouteContext) {
  const disabled = requirePreviewLinksEnabled();
  if (disabled) {
    return disabled;
  }

  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { postId } = await context.params;
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

  if (!canCreatePostPreviewLink(post.status)) {
    return NextResponse.json(
      { error: "Preview links are only available for unpublished posts" },
      { status: 409 },
    );
  }

  const created = await createPostPreviewLink(getDb(), {
    postId: post.id,
    createdBy: auth.actor,
    siteOrigin: getPublicSiteOrigin(),
  });

  return NextResponse.json({
    link: {
      id: created.linkId,
      previewUrl: created.previewUrl,
      expiresAt: created.expiresAt.toISOString(),
    },
  });
}
