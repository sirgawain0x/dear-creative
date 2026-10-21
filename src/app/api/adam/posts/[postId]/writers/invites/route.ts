import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { requireCowritersEnabled } from "@/lib/cowriters/api-guard";
import { createCowriterInvite } from "@/lib/cowriters/invites";
import { getEditorWritersSnapshot } from "@/lib/cowriters/editor-writers";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

type InviteBody = {
  email?: string;
  wallet?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const disabled = requireCowritersEnabled();
  if (disabled) {
    return disabled;
  }

  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId } = await context.params;
  const post = await getAdminPostByIdOrSlug(getDb(), postId);
  if (!post || post.id.startsWith("content:")) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const inviteBaseUrl = new URL(request.url).origin;

  try {
    const created = await createCowriterInvite(getDb(), {
      postId: post.id,
      invitedBy: auth.actor,
      email: body.email,
      wallet: body.wallet,
      inviteBaseUrl,
    });
    const snapshot = await getEditorWritersSnapshot(getDb(), post.id);
    return NextResponse.json({
      invite: created,
      ...snapshot,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
