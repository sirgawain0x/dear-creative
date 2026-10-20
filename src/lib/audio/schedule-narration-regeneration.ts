import { after } from "next/server";
import type { DearCreativeDb } from "@/db/client";
import type { CorePostRow } from "@/db/ensure-schema";
import type { PostStatus } from "@/db/schema";
import { postNarrationContentChanged } from "@/lib/audio/invalidate-post-audio";
import { regenerateStoredPostNarration } from "@/lib/audio/regenerate-stored-post-narration";

type BackgroundTask = () => void | Promise<void>;

let afterHookForTests: ((task: BackgroundTask) => void) | null = null;
let regenerateOverride: typeof regenerateStoredPostNarration | null = null;

export function setRegenerateStoredPostNarrationForTests(
  fn: typeof regenerateStoredPostNarration | null,
): void {
  regenerateOverride = fn;
}

/** Runs background narration work immediately in unit tests. */
export function setPostNarrationAfterHookForTests(
  hook: ((task: BackgroundTask) => void) | null,
): void {
  afterHookForTests = hook;
}

function scheduleBackgroundNarrationTask(task: BackgroundTask): void {
  if (afterHookForTests) {
    afterHookForTests(task);
    return;
  }
  after(() => {
    void task();
  });
}

export function maybeSchedulePublishedPostNarrationRegeneration(input: {
  db: DearCreativeDb;
  postId: string;
  existing: CorePostRow;
  nextStatus: PostStatus;
  nextTitle: string;
  nextTeaserText: string | null;
  nextBodyHtml: string | null;
  hasStoredAudioUrl: boolean;
  explicitAudioUpdate: boolean;
  actor?: string;
}): void {
  if (input.explicitAudioUpdate) {
    return;
  }
  if (input.nextStatus !== "published") {
    return;
  }

  const narrationChanged = postNarrationContentChanged(input.existing, {
    title: input.nextTitle,
    teaserText: input.nextTeaserText,
    bodyHtml: input.nextBodyHtml,
  });

  if (input.hasStoredAudioUrl && !narrationChanged) {
    return;
  }

  const { db, postId, actor } = input;
  const regen = regenerateOverride ?? regenerateStoredPostNarration;
  scheduleBackgroundNarrationTask(async () => {
    await regen(db, postId, { actor });
  });
}
