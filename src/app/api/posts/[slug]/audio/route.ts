import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getPostAudioColumns } from "@/db/ensure-schema";
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

  const audio = await getPostAudioColumns(db, slug);
  const audioUrl = audio.audioUrl?.trim();

  if (audioUrl) {
    return NextResponse.json({
      ok: true,
      audioUrl,
      voice: audio.audioVoice?.trim() || "Puck",
      preGenerated: true,
      mimeType: "audio/mpeg",
    });
  }

  return NextResponse.json(
    { error: "Audio not available for this post" },
    { status: 404 },
  );
}
