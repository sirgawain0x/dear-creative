import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { DearCreativeDb } from "@/db/client";
import { postWriters, posts } from "@/db/schema";
import type { StudioAuthSuccess } from "@/lib/adam/studio-auth";
import { isPrivyAdminUserId } from "@/lib/privy/session-from-cookies";

export async function canManagePostPreviewLinks(
  db: DearCreativeDb,
  postId: string,
  auth: StudioAuthSuccess,
): Promise<boolean> {
  if (auth.mode === "adam_token") {
    return true;
  }
  if (isPrivyAdminUserId(auth.actor)) {
    return true;
  }

  const [postRow] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!postRow?.authorId) {
    return false;
  }
  if (postRow.authorId === auth.actor) {
    return true;
  }

  const [authorMembership] = await db
    .select({ writerId: postWriters.writerId })
    .from(postWriters)
    .where(
      and(
        eq(postWriters.postId, postId),
        eq(postWriters.role, "author"),
        eq(postWriters.status, "accepted"),
      ),
    )
    .limit(1);

  return authorMembership?.writerId === auth.actor;
}

export async function requirePostPreviewLinkManageAccess(
  db: DearCreativeDb,
  postId: string,
  auth: StudioAuthSuccess,
): Promise<NextResponse | null> {
  const allowed = await canManagePostPreviewLinks(db, postId, auth);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
