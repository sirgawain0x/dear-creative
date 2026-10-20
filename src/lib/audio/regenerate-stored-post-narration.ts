import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import {
  corePostColumns,
  ensurePostsSchema,
  getPostAudioColumns,
  setPostAudioColumns,
} from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import { writeAuditEvent } from "@/lib/audit/write-audit-event";
import * as narration from "@/lib/audio/narration";
import { publishedPostCacheTag } from "@/lib/posts/published-posts";

export type RegenerateStoredPostNarrationOptions = {
  voice?: string;
  actor?: string;
  generateFn?: typeof narration.generatePostNarrationMp3;
  logError?: (message: string, error: unknown) => void;
};

/**
 * Generates a fresh narration MP3 and updates `audio_url` when the post is
 * published. On failure the previous URL is left unchanged.
 */
export async function regenerateStoredPostNarration(
  db: DearCreativeDb,
  postId: string,
  options: RegenerateStoredPostNarrationOptions = {},
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const logError =
    options.logError ??
    ((message: string, error: unknown) => {
      console.error(message, error);
    });

  await ensurePostsSchema(db);
  const [row] = await db
    .select(corePostColumns)
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "post_not_found" };
  }
  if (row.status !== "published") {
    return { ok: false, reason: "not_published" };
  }

  const storedAudio = await getPostAudioColumns(db, postId);
  const voice =
    options.voice?.trim() ||
    storedAudio.audioVoice?.trim() ||
    "Puck";
  if (!narration.isNarrationVoice(voice)) {
    return { ok: false, reason: "unsupported_voice" };
  }

  const generate =
    options.generateFn ??
    ((params: Parameters<typeof narration.generatePostNarrationMp3>[0]) =>
      narration.generatePostNarrationMp3(params));

  try {
    const narration = await generate({
      slug: row.slug,
      title: row.title,
      teaserText: row.teaserText,
      bodyHtml: row.bodyHtml ?? row.emailHtml,
      voice,
    });

    await setPostAudioColumns(db, postId, {
      audioUrl: narration.url,
      audioVoice: voice,
    });

    await writeAuditEvent(db, {
      actor: options.actor ?? "system",
      action: "post.narration_generated",
      entityType: "post",
      entityId: postId,
      payload: {
        voice,
        uri: narration.uri,
        bytes: narration.bytes,
        chunks: narration.chunks,
        provider: narration.provider,
        background: true,
      },
    });

    revalidateTag(publishedPostCacheTag(row.slug), "max");

    return { ok: true, url: narration.url };
  } catch (error) {
    logError(
      `[narration] Background regeneration failed for post ${postId}`,
      error,
    );
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "regeneration_failed",
    };
  }
}
