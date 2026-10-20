import { describe, expect, it } from "vitest";
import { setPostAudioColumns } from "@/db/ensure-schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { loadPixelsPostDataFromDb } from "./post-data";

describe("loadPixelsPostDataFromDb", () => {
  it("returns null when post has no embedded video assets", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "no-video",
      title: "No Video",
      status: "published",
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      bodyHtml: "<p>Text only</p>",
    });

    const data = await loadPixelsPostDataFromDb(db, "no-video");
    expect(data).toBeNull();
  });

  it("returns null for draft posts even when assets exist", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-with-video",
      title: "Draft",
      status: "draft",
      publishedAt: null,
      bodyHtml:
        '<video src="https://api.grove.storage/v16.mp4"></video><video src="https://api.grove.storage/v9.mp4"></video>',
    });

    const data = await loadPixelsPostDataFromDb(db, "draft-with-video");
    expect(data).toBeNull();
  });

  it("maps banners, videos, and audio from a published post row", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "clip-ready",
      title: "Clip Ready",
      status: "published",
      publishedAt: new Date("2025-02-01T00:00:00.000Z"),
      teaserText: "Teaser line",
      bodyHtml:
        '<p><video src="https://api.grove.storage/v16.mp4"></video><video src="https://api.grove.storage/v9.mp4"></video></p>',
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

    const data = await loadPixelsPostDataFromDb(db, "clip-ready");
    expect(data?.slug).toBe("clip-ready");
    expect(data?.audioUrl).toContain("narration.mp3");
    expect(data?.videoUrls["16:9"]).toContain("v16.mp4");
    expect(data?.bannerUrls["16:9"]).toBeTruthy();
  });
});
