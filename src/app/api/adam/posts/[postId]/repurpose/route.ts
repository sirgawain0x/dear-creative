import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isRepurposeEnabled } from "@/lib/adam/repurpose/feature-flag";
import { loadRepurposePostSource, RepurposePostError } from "@/lib/adam/repurpose/post-source";
import {
  ensureRepurposeTable,
  listRepurposeOutputsForPost,
} from "@/lib/adam/repurpose/storage";
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
    await ensureRepurposeTable(db);
    const source = await loadRepurposePostSource(db, postId);
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
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to list repurpose outputs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
