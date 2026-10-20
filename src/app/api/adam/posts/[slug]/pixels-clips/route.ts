import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { runDearCreativePixelsClipGeneration } from "@/lib/adam/pixels/run-clip-generation";
import { requireAdamAuth } from "@/lib/adam/require-auth";

type RouteContext = { params: Promise<{ slug: string }> };

type RequestBody = {
  dryRun?: boolean;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = requireAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug } = await context.params;
  const dryRun = body.dryRun !== false;

  try {
    const result = await runDearCreativePixelsClipGeneration({
      db: getDb(),
      slug,
      dryRun,
      pixelsBaseUrl: process.env.PIXELS_API_URL,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clip generation failed";
    if (message.includes("not configured")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
