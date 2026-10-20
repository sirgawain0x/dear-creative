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
  logStale?: (message: string) => void;
  /** Test hook: fired after the narration script snapshot is taken, before TTS. */
  onSynthesizedScriptReady?: (script: string) => void;
};

function narrationScriptForRow(row: {
  title: string;
  teaserText: string | null;
  bodyHtml: string | null;
  emailHtml: string | null;
}): string {
  return narration.buildNarrationScript({
    title: row.title,
    teaserText: row.teaserText,
    bodyHtml: row.bodyHtml ?? row.emailHtml,
  });
}

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
  const logStale =
    options.logStale ??
    ((message: string) => {
      console.warn(message);
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

  const synthesizedScript = narrationScriptForRow(row);
  options.onSynthesizedScriptReady?.(synthesizedScript);

  const generate =
    options.generateFn ??
    ((params: Parameters<typeof narration.generatePostNarrationMp3>[0]) =>
      narration.generatePostNarrationMp3(params));

  try {
    const mp3 = await generate({
      slug: row.slug,
      title: row.title,
      teaserText: row.teaserText,
      bodyHtml: row.bodyHtml ?? row.emailHtml,
      voice,
    });

    const [current] = await db
      .select(corePostColumns)
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!current || current.status !== "published") {
      logStale(
        `[narration] Dropped stale MP3 for post ${postId}: post no longer published before upload commit`,
      );
      return { ok: false, reason: "stale_narration" };
    }

    const currentScript = narrationScriptForRow(current);
    if (currentScript !== synthesizedScript) {
      logStale(
        `[narration] Dropped stale MP3 for post ${postId}: narration text changed during TTS`,
      );
      return { ok: false, reason: "stale_narration" };
    }

    await setPostAudioColumns(db, postId, {
      audioUrl: mp3.url,
      audioVoice: voice,
    });

    await writeAuditEvent(db, {
      actor: options.actor ?? "system",
      action: "post.narration_generated",
      entityType: "post",
      entityId: postId,
      payload: {
        voice,
        uri: mp3.uri,
        bytes: mp3.bytes,
        chunks: mp3.chunks,
        provider: mp3.provider,
        background: true,
      },
    });

    revalidateTag(publishedPostCacheTag(row.slug), "max");

    return { ok: true, url: mp3.url };
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
