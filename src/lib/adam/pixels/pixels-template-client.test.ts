import { describe, expect, it, vi } from "vitest";
import {
  PixelsHttpClient,
  createImportMediaOps,
  type PostData,
} from "./pixels-template-client";

const samplePost: PostData = {
  id: "post-1",
  slug: "demo",
  title: "Demo",
  teaserText: "Teaser",
  publishedAt: Date.now(),
  audioUrl: "https://api.grove.storage/audio.mp3",
  bannerUrls: {
    "16:9": "https://api.grove.storage/banner.png",
    "1:1": "https://api.grove.storage/banner.png",
  },
  videoUrls: {
    "16:9": "https://api.grove.storage/v16.mp4",
    "9:16": "https://api.grove.storage/v9.mp4",
  },
};

describe("PixelsHttpClient", () => {
  it("does not send X-PAYMENT headers", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "proj-1", name: "Test" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new PixelsHttpClient("https://pixels.example.com");
    await client.createProject({ name: "Test", width: 1080, height: 1920 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://pixels.example.com/v1/projects",
      expect.objectContaining({
        method: "POST",
        headers: expect.not.objectContaining({
          "X-PAYMENT": expect.anything(),
        }),
      }),
    );
  });
});

describe("createImportMediaOps", () => {
  it("imports banner, video, and narration for 16:9", () => {
    const ops = createImportMediaOps(samplePost, "16:9");
    expect(ops).toHaveLength(3);
    expect(ops[0]).toMatchObject({
      op: "importMedia",
      mediaId: "banner-16:9",
    });
    expect(ops[1]).toMatchObject({
      op: "importMedia",
      mediaId: "video-16:9",
    });
    expect(ops[2]).toMatchObject({
      op: "importMedia",
      mediaId: "audio-narration",
    });
  });
});
