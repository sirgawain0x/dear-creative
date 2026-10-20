import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params;
  const db = getDb();

  const post = await getPublishedPostBySlug(db, slug);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const audioUrl = post.audioUrl?.trim();

  if (audioUrl) {
    return NextResponse.json({
      ok: true,
      audioUrl,
      voice: post.audioVoice?.trim() || "Puck",
      preGenerated: true,
      mimeType: "audio/mpeg",
    });
  }

  return NextResponse.json(
    { error: "Audio not available for this post" },
    { status: 404 },
  );
}
