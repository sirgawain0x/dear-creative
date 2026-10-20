import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateVideoOverview } from "./video-overview";

describe("generateVideoOverview", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("narrates speaker notes per slide and passes synthesizeFn", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const slideDeck = {
      title: "Deck",
      slides: [
        {
          title: "One",
          bullets: ["A"],
          speakerNotes: "First slide narration.",
        },
        {
          title: "Two",
          bullets: ["B"],
          speakerNotes: "Second slide narration.",
        },
      ],
    };

    const fetchFn = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        generationConfig?: { responseSchema?: unknown };
      };
      const isSlideDeck = Boolean(body.generationConfig?.responseSchema);
      const text = isSlideDeck
        ? JSON.stringify(slideDeck)
        : JSON.stringify({
            title: "unused",
            segments: [{ speaker: "host_a", text: "x" }],
          });
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }],
        }),
        { status: 200 },
      );
    });

    const synthesizeFn = vi.fn().mockResolvedValue({
      audioBase64: Buffer.from("fake-mp3").toString("base64"),
      mimeType: "audio/mp3",
      provider: "mock",
    });

    const ffmpeg = vi.fn(async (args: string[]) => {
      const outArg = args.at(-1);
      if (outArg?.endsWith(".mp4")) {
        await writeFile(outArg, Buffer.from("mock-mp4"));
      }
    });

    const uploadFn = vi.fn().mockResolvedValue({
      gatewayUrl: "https://api.grove.storage/video.mp4",
      uri: "lens://video",
      storageKey: "video",
    });

    const result = await generateVideoOverview({
      source: {
        id: "p1",
        slug: "vid",
        title: "Vid",
        status: "published",
        authorId: "author-1",
        teaserText: null,
        plainText: "Article",
      },
      fetchFn,
      synthesizeFn,
      ffmpeg,
      uploadFn,
    });

    expect(synthesizeFn).toHaveBeenCalledTimes(2);
    expect(synthesizeFn.mock.calls[0]?.[0]?.text).toBe("First slide narration.");
    expect(synthesizeFn.mock.calls[1]?.[0]?.text).toBe("Second slide narration.");
    expect(ffmpeg.mock.calls.length).toBeGreaterThan(0);
    expect(result.mediaUrl).toContain("grove.storage");
    expect(result.payload.mode).toBe("narrated_slides");
  });
});
