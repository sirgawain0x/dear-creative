import { describe, expect, it } from "vitest";
import { setPostAudioColumns } from "@/db/ensure-schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { runDearCreativePixelsClipGeneration } from "./run-clip-generation";

describe("runDearCreativePixelsClipGeneration", () => {
  it("returns a dry-run preview without calling Pixels", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "clip-ready",
      title: "Clip Ready",
      status: "published",
      publishedAt: new Date("2025-02-01T00:00:00.000Z"),
      bodyHtml:
        '<video src="https://api.grove.storage/v16.mp4"></video><video src="https://api.grove.storage/v9.mp4"></video>',
    });
    const row = await db.query.posts.findFirst({
      where: (posts, { eq }) => eq(posts.slug, "clip-ready"),
    });
    if (!row) {
      throw new Error("missing row");
    }
    await setPostAudioColumns(db, row.id, {
      audioUrl: "https://api.grove.storage/narration.mp3",
      audioVoice: "Puck",
    });

    const result = await runDearCreativePixelsClipGeneration({
      db,
      slug: "clip-ready",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    if (result.dryRun) {
      expect(result.slug).toBe("clip-ready");
      expect(result.hasAudio).toBe(true);
      expect(result.hasVideoAssets).toBe(true);
    }
  });
});
