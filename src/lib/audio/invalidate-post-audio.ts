import type { DearCreativeDb } from "@/db/client";
import { setPostAudioColumns } from "@/db/ensure-schema";
import type { CorePostRow } from "@/db/ensure-schema";
import type { UpdateAdminPostInput } from "@/lib/posts/manage-posts";

/** Fields that change the spoken narration script for a post. */
export function postNarrationContentChanged(
  existing: CorePostRow,
  input: UpdateAdminPostInput,
  resolved: {
    title: string;
    slug: string;
    teaserText: string | null;
    bodyHtml: string | null;
    emailHtml: string | null;
  },
): boolean {
  if (input.title !== undefined && resolved.title !== existing.title) {
    return true;
  }
  if (input.slug !== undefined && resolved.slug !== existing.slug) {
    return true;
  }
  if (
    input.teaserText !== undefined &&
    resolved.teaserText !== (existing.teaserText ?? null)
  ) {
    return true;
  }
  const prevBody = existing.bodyHtml ?? null;
  if (resolved.bodyHtml !== prevBody) {
    return true;
  }
  const prevEmail = existing.emailHtml ?? null;
  if (
    input.emailHtml !== undefined &&
    resolved.emailHtml !== prevEmail
  ) {
    return true;
  }
  return false;
}

export async function clearStoredPostAudio(
  db: DearCreativeDb,
  postId: string,
): Promise<void> {
  await setPostAudioColumns(db, postId, {
    audioUrl: null,
    audioVoice: null,
  });
}
