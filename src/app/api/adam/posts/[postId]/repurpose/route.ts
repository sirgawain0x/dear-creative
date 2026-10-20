import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { assertRepurposeCallerAccess } from "@/lib/adam/repurpose/access";
import { isRepurposeEnabled } from "@/lib/adam/repurpose/feature-flag";
import { loadRepurposePostSource, RepurposePostError } from "@/lib/adam/repurpose/post-source";
import { listRepurposeOutputsForPost } from "@/lib/adam/repurpose/storage";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  if (!isRepurposeEnabled()) {
    return NextResponse.json({ error: "Repurpose is not enabled." }, { status: 503 });
  }

  const { postId } = await context.params;
  const db = getDb();
  try {
    const source = await loadRepurposePostSource(db, postId);
    await assertRepurposeCallerAccess({
      db,
      postAuthorId: source.authorId,
      postStatus: source.status,
      auth,
    });
    const outputs = await listRepurposeOutputsForPost(db, source.id);
    return NextResponse.json({
      postId: source.id,
      slug: source.slug,
      outputs,
    });
  } catch (error) {
    if (error instanceof RepurposePostError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "not_found" ? 404 : 403 },
      );
    }
    console.error("[repurpose] list failed", error);
    return NextResponse.json({ error: "Failed to list repurpose outputs." }, { status: 500 });
  }
}
