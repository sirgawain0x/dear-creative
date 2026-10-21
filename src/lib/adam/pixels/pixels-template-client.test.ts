import { describe, expect, it, vi } from "vitest";
import {
  PixelsHttpClient,
  generateDearCreativeClips,
  type PostData,
} from "./pixels-template-client";

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

describe("generateDearCreativeClips", () => {
  it("uploads render outputBase64 via uploadToLensGrove", async () => {
    const post: PostData = {
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

    const renderBase64 = Buffer.from("rendered-mp4").toString("base64");
    const pixelsClient = {
      createProject: vi.fn(async () => ({ id: "proj-1" })),
      editProject: vi.fn(async () => ({ id: "proj-1" })),
      renderProject: vi.fn(async () => ({
        ok: true,
        outputBase64: renderBase64,
      })),
    } as unknown as PixelsHttpClient;

    const uploadToGrove = vi.fn(async () => ({
      uri: "lens://clip123",
      gatewayUrl: "https://api.grove.storage/clip123",
      storageKey: "clip123",
    }));

    const db = {} as never;
    const result = await generateDearCreativeClips({
      postSlug: "demo",
      db,
      pixelsBaseUrl: "https://pixels.example.com",
      post,
      outputFormats: ["1:1"],
      pixelsClient,
      uploadToGrove,
    });

    expect(uploadToGrove).toHaveBeenCalledTimes(1);
    expect(result.thumbnail1x1.url).toContain("clip123");
    expect(result.thumbnail1x1.uri).toBe("lens://clip123");
  });
});
