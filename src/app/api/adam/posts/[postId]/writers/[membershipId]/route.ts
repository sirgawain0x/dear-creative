import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { requireCowritersEnabled } from "@/lib/cowriters/api-guard";
import { getEditorWritersSnapshot } from "@/lib/cowriters/editor-writers";
import { removeCowriterMembership } from "@/lib/cowriters/invites";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";

type RouteContext = {
  params: Promise<{ postId: string; membershipId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const disabled = requireCowritersEnabled();
  if (disabled) {
    return disabled;
  }

  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { postId, membershipId } = await context.params;
  const post = await getAdminPostByIdOrSlug(getDb(), postId);
  if (!post || post.id.startsWith("content:")) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const removed = await removeCowriterMembership(
    getDb(),
    post.id,
    membershipId,
  );
  if (!removed) {
    return NextResponse.json({ error: "Co-writer not found" }, { status: 404 });
  }

  const snapshot = await getEditorWritersSnapshot(getDb(), post.id);
  return NextResponse.json(snapshot);
}
