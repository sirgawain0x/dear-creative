import { NextResponse } from "next/server";
import { isRepurposeEnabled } from "@/lib/adam/repurpose/feature-flag";
import { getFfmpegVersionLine, resolveFfmpegBinaryPath } from "@/lib/adam/repurpose/ffmpeg";
import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";

/**
 * Auth-gated ffmpeg binary check for preview diagnostics.
 * Safe to remove after verifying Vercel bundles ffmpeg-static.
 */
export async function GET(request: Request) {
  const auth = await requireStudioOrAdamAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  if (!isRepurposeEnabled()) {
    return NextResponse.json({ error: "Repurpose is not enabled." }, { status: 503 });
  }

  const diagFlag = process.env.REPURPOSE_FFMPEG_DIAG?.trim() === "1";
  const vercelPreview = process.env.VERCEL_ENV === "preview";
  if (process.env.NODE_ENV === "production" && !diagFlag && !vercelPreview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const binary = resolveFfmpegBinaryPath();
    const { versionLine } = await getFfmpegVersionLine();
    console.info("[repurpose][ffmpeg-diag]", { binary, versionLine });
    return NextResponse.json({
      ok: true,
      binary,
      versionLine,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "ffmpeg diagnostic failed";
    console.error("[repurpose][ffmpeg-diag] failed", detail);
    return NextResponse.json(
      {
        ok: false,
        binary: resolveFfmpegBinaryPath(),
        error: "ffmpeg diagnostic failed.",
      },
      { status: 500 },
    );
  }
}
