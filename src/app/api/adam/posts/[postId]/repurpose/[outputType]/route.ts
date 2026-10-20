import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isRepurposeEnabled } from "@/lib/adam/repurpose/feature-flag";
import {
  RepurposeGenerationError,
  runRepurposeGeneration,
} from "@/lib/adam/repurpose/run-generation";
import {
  ensureRepurposeTable,
  getRepurposeOutput,
} from "@/lib/adam/repurpose/storage";
import {
  isRepurposeOutputType,
  type RepurposeOutputType,
} from "@/lib/adam/repurpose/types";
import { loadRepurposePostSource, RepurposePostError } from "@/lib/adam/repurpose/post-source";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";

type RouteContext = {
  params: Promise<{ postId: string; outputType: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  if (!isRepurposeEnabled()) {
    return NextResponse.json({ error: "Repurpose is not enabled." }, { status: 503 });
  }

  const { postId, outputType: rawType } = await context.params;
  if (!isRepurposeOutputType(rawType)) {
    return NextResponse.json({ error: "Invalid output type" }, { status: 400 });
  }

  const db = getDb();
  try {
    await ensureRepurposeTable(db);
    const source = await loadRepurposePostSource(db, postId);
    const output = await getRepurposeOutput(
      db,
      source.id,
      rawType as RepurposeOutputType,
    );
    if (!output) {
      return NextResponse.json({ output: null });
    }
    return NextResponse.json({ output });
  } catch (error) {
    if (error instanceof RepurposePostError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    return NextResponse.json({ error: "Failed to load output" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  if (!isRepurposeEnabled()) {
    return NextResponse.json({ error: "Repurpose is not enabled." }, { status: 503 });
  }

  const { postId, outputType: rawType } = await context.params;
  if (!isRepurposeOutputType(rawType)) {
    return NextResponse.json({ error: "Invalid output type" }, { status: 400 });
  }

  const db = getDb();
  try {
    const output = await runRepurposeGeneration({
      db,
      postIdOrSlug: postId,
      outputType: rawType,
    });
    return NextResponse.json({ output });
  } catch (error) {
    if (error instanceof RepurposeGenerationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.httpStatus },
      );
    }
    if (error instanceof RepurposePostError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Repurpose generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
