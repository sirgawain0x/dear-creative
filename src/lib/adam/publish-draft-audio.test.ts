import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { posts } from "@/db/schema";
import { getPostAudioColumns } from "@/db/ensure-schema";
import type { NarrationResult } from "@/lib/audio/narration";
import { regenerateStoredPostNarration } from "@/lib/audio/regenerate-stored-post-narration";
import {
  setPostNarrationAfterHookForTests,
  setRegenerateStoredPostNarrationForTests,
} from "@/lib/audio/schedule-narration-regeneration";
import { publishDraftToTurso } from "./publish-draft";

const generatePostNarrationMp3Mock = vi.hoisted(() => vi.fn());

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-adam-publish-audio-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

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

describe("publishDraftToTurso narration scheduling", () => {
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

  it("schedules initial narration when creating a published post without audio", async () => {
    const db = await createTestDb();
    generatePostNarrationMp3Mock.mockResolvedValue(
      mockNarrationResult("https://cdn.example/publish-draft.mp3"),
    );

    const result = await publishDraftToTurso(db, {
      slug: "published-on-create",
      title: "Live on create",
      bodyHtml: "<p>Hello listeners</p>",
      status: "published",
    });

    expect(pendingTasks).toHaveLength(1);
    await flushBackgroundTasks();

    expect(generatePostNarrationMp3Mock).toHaveBeenCalledTimes(1);
    const [row] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, result.postId));
    expect(row?.id).toBe(result.postId);
    const audio = await getPostAudioColumns(db, result.postId);
    expect(audio.audioUrl).toBe("https://cdn.example/publish-draft.mp3");
  });
});
