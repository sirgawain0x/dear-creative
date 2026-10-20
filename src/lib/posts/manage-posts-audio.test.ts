import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPostAudioColumns, setPostAudioColumns } from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import type { NarrationResult } from "@/lib/audio/narration";
import { regenerateStoredPostNarration } from "@/lib/audio/regenerate-stored-post-narration";
import {
  setPostNarrationAfterHookForTests,
  setRegenerateStoredPostNarrationForTests,
} from "@/lib/audio/schedule-narration-regeneration";
import { ensureArticleHtml } from "@/lib/html/markdown-to-html";
import { createPostsTestDb } from "@/lib/posts/test-support/posts-test-db";
import { updateAdminPost } from "./manage-posts";

const generatePostNarrationMp3Mock = vi.hoisted(() => vi.fn());

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

describe("manage-posts published narration regeneration", () => {
  const pendingTasks: Array<() => void | Promise<void>> = [];

  beforeEach(() => {
    generatePostNarrationMp3Mock.mockReset();
    pendingTasks.length = 0;
    setPostNarrationAfterHookForTests((task) => {
      pendingTasks.push(task);
    });
    setRegenerateStoredPostNarrationForTests((db, postId, options) =>
      regenerateStoredPostNarration(db, postId, {
        ...options,
        generateFn: generatePostNarrationMp3Mock,
      }),
    );
  });

  afterEach(() => {
    setPostNarrationAfterHookForTests(null);
    setRegenerateStoredPostNarrationForTests(null);
  });

  async function flushBackgroundTasks() {
    for (const task of pendingTasks.splice(0)) {
      await task();
    }
  }

  it("does not call TTS when spoken text is unchanged on a published post", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "published-stable",
      title: "Stable title",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Stable body</p>",
      emailSubject: "Old subject",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/keep.mp3",
      audioVoice: "Puck",
    });

    await updateAdminPost(db, postId, {
      emailSubject: "New subject only",
    });
    await flushBackgroundTasks();

    expect(generatePostNarrationMp3Mock).not.toHaveBeenCalled();
    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/keep.mp3");
  });

  it("schedules exactly one regeneration when published post narration text changes", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "published-edit",
      title: "Title",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Before</p>",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/before.mp3",
      audioVoice: "Puck",
    });
    generatePostNarrationMp3Mock.mockResolvedValue(
      mockNarrationResult("https://cdn.example/after.mp3"),
    );

    await updateAdminPost(db, postId, {
      bodyHtml: "<p>After narration change</p>",
    });
    expect(pendingTasks).toHaveLength(1);
    await flushBackgroundTasks();

    expect(generatePostNarrationMp3Mock).toHaveBeenCalledTimes(1);
    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/after.mp3");
  });

  it("keeps the previous audio URL when regeneration fails", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "published-fail",
      title: "Title",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: "<p>Body</p>",
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/safe.mp3",
      audioVoice: "Puck",
    });
    generatePostNarrationMp3Mock.mockRejectedValue(new Error("tts unavailable"));

    const result = await regenerateStoredPostNarration(db, postId, {
      generateFn: generatePostNarrationMp3Mock,
      logError: () => {},
    });

    expect(result.ok).toBe(false);
    expect(generatePostNarrationMp3Mock).toHaveBeenCalledTimes(1);
    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/safe.mp3");
  });

  it("keeps audio and skips TTS on markdown resave when spoken text is unchanged", async () => {
    const db = await createPostsTestDb();
    const postId = randomUUID();
    const markdown = "Same spoken words in the article.";
    const legacyHtml =
      "<div><p>Same spoken words in the article.</p></div>";
    expect(ensureArticleHtml(markdown)).not.toBe(legacyHtml);

    await db.insert(posts).values({
      id: postId,
      slug: "markdown-published",
      title: "Markdown resave",
      status: "published",
      publishedAt: new Date(),
      bodyHtml: legacyHtml,
    });
    await setPostAudioColumns(db, postId, {
      audioUrl: "https://cdn.example/markdown-keep.mp3",
      audioVoice: "Puck",
    });

    await updateAdminPost(db, postId, { markdown });
    await flushBackgroundTasks();

    expect(generatePostNarrationMp3Mock).not.toHaveBeenCalled();
    const audio = await getPostAudioColumns(db, postId);
    expect(audio.audioUrl).toBe("https://cdn.example/markdown-keep.mp3");
  });
});
