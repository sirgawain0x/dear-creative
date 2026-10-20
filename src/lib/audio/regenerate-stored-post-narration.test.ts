import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPostAudioColumns, setPostAudioColumns } from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import type { NarrationResult } from "@/lib/audio/narration";
import { regenerateStoredPostNarration } from "@/lib/audio/regenerate-stored-post-narration";
import { createPostsTestDb } from "@/lib/posts/test-support/posts-test-db";

const generatePostNarrationMp3Mock = vi.fn();

function mockNarrationResult(url: string): NarrationResult {
  return {
    url,
    uri: "lens://test",
    storageKey: "key",
    voice: "Puck",
    mimeType: "audio/mpeg",
    bytes: 100,
    chunks: 1,
    provider: "mock",
  };
}

describe("regenerateStoredPostNarration", () => {
  beforeEach(() => {
    generatePostNarrationMp3Mock.mockReset();
  });

  it("does not overwrite newer audio when an older TTS job finishes last", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "race-narration",
      title: "Race",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Original words</p>",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/seed.mp3",
      audioVoice: "Puck",
    });

    let releaseSlow: (() => void) | undefined;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    let releaseSlowEntered: (() => void) | undefined;
    const slowEnteredGenerate = new Promise<void>((resolve) => {
      releaseSlowEntered = resolve;
    });

    generatePostNarrationMp3Mock.mockImplementationOnce(async () => {
      releaseSlowEntered?.();
      await slowGate;
      return mockNarrationResult("https://cdn.example/stale-slow.mp3");
    });
    generatePostNarrationMp3Mock.mockImplementationOnce(async () =>
      mockNarrationResult("https://cdn.example/current-fast.mp3"),
    );

    let scriptReady: (() => void) | undefined;
    const slowScriptReady = new Promise<void>((resolve) => {
      scriptReady = resolve;
    });

    const slowJob = regenerateStoredPostNarration(db, postId, {
      generateFn: generatePostNarrationMp3Mock,
      logError: () => {},
      logStale: () => {},
      onSynthesizedScriptReady: () => {
        scriptReady?.();
      },
    });

    await slowScriptReady;
    await slowEnteredGenerate;

    await db
      .update(posts)
      .set({ bodyHtml: "<p>Updated words for narration</p>" })
      .where(eq(posts.id, postId));

    await regenerateStoredPostNarration(db, postId, {
      generateFn: generatePostNarrationMp3Mock,
      logError: () => {},
      logStale: () => {},
    });

    releaseSlow?.();
    await slowJob;

    expect(generatePostNarrationMp3Mock).toHaveBeenCalledTimes(2);
    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/current-fast.mp3");
  });
});
