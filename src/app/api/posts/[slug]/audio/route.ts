import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getPublishedPostRowBySlug } from "@/lib/posts/published-posts";
import { isPaywallEnabled } from "@/lib/paywall/feature-flag";
import { canReadFull } from "@/lib/paywall/can-read-full";
import { resolvePostViewerFromCookies } from "@/lib/paywall/viewer-from-cookies";
import { cookies } from "next/headers";

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params;
  const db = getDb();

  const row = await getPublishedPostRowBySlug(db, slug);

  if (!row) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (isPaywallEnabled() && row.isGated) {
    const cookieStore = await cookies();
    const readCookie = (name: string) => cookieStore.get(name)?.value;
    const viewer = await resolvePostViewerFromCookies(db, readCookie);
    const entitled = await canReadFull(
      db,
      {
        isGated: row.isGated,
        authorId: row.authorId,
        postId: row.postId,
      },
      viewer,
    );
    if (!entitled) {
      return NextResponse.json(
        { error: "Audio not available for this post" },
        { status: 403 },
      );
    }
  }

  const audioUrl = row.audioUrl?.trim();

  if (audioUrl) {
    return NextResponse.json({
      ok: true,
      audioUrl,
      voice: row.audioVoice?.trim() || "Puck",
      preGenerated: true,
      mimeType: "audio/mpeg",
    });
  }

  return NextResponse.json(
    { error: "Audio not available for this post" },
    { status: 404 },
  );
}
