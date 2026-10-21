import { writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetRepurposeMockEnvForTests,
  setRepurposeMockEnvForTests,
} from "../mock-mode";
import { generateVideoOverview } from "./video-overview";

const source = {
  id: "p1",
  slug: "vid",
  title: "Preview Post",
  status: "published" as const,
  authorId: "author-1",
  teaserText: null,
  plainText: "Article body",
};

describe("generateVideoOverview REPURPOSE_MOCK_TTS gate", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRepurposeMockEnvForTests();
  });

  it("uses real Gemini paths in production when flag is true", async () => {
    setRepurposeMockEnvForTests({
      vercelEnv: "production",
      repurposeMockTts: "true",
    });

    const slideDeck = {
      title: "Deck",
      slides: [
        {
          title: "One",
          bullets: ["A"],
          speakerNotes: "Narration.",
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
        : JSON.stringify({ title: "unused" });
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
      provider: "gemini-tts" as const,
    });

    const ffmpeg = vi.fn(async (args: string[]) => {
      if (args.includes("-hide_banner") && args.includes("-i")) {
        const err = new Error("probe") as Error & { stderr: string };
        err.stderr = "Duration: 00:00:03.00, start: 0.000000";
        throw err;
      }
      const outArg = args.at(-1);
      if (outArg?.endsWith(".mp4")) {
        await writeFile(outArg, Buffer.from("mock-mp4"));
      }
    });

    await generateVideoOverview({
      source,
      fetchFn,
      synthesizeFn,
      ffmpeg,
      uploadFn: vi.fn().mockResolvedValue({
        gatewayUrl: "https://example.test/v.mp4",
        uri: "lens://v",
        storageKey: "v",
      }),
      pipeline: { skipRenderPreflight: true },
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(synthesizeFn).toHaveBeenCalled();
  });

  it("uses mock deck and mock TTS in preview with zero Gemini calls", async () => {
    setRepurposeMockEnvForTests({
      vercelEnv: "preview",
      repurposeMockTts: "true",
    });

    const fetchFn = vi.fn(async () => {
      throw new Error("Gemini fetch must not run in mock mode");
    });
    const synthesizeFn = vi.fn(async () => {
      throw new Error("Gemini TTS must not run in mock mode");
    });

    const ffmpeg = vi.fn(async (args: string[]) => {
      if (args.includes("-hide_banner") && args.includes("-i")) {
        const err = new Error("probe") as Error & { stderr: string };
        err.stderr = "Duration: 00:00:03.00, start: 0.000000";
        throw err;
      }
      const outArg = args.at(-1);
      if (outArg?.endsWith(".mp4")) {
        await writeFile(outArg, Buffer.from("mock-mp4"));
      }
    });

    const result = await generateVideoOverview({
      source,
      fetchFn,
      synthesizeFn,
      ffmpeg,
      uploadFn: vi.fn().mockResolvedValue({
        gatewayUrl: "https://example.test/v.mp4",
        uri: "lens://v",
        storageKey: "v",
      }),
      pipeline: { skipRenderPreflight: true },
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(synthesizeFn).not.toHaveBeenCalled();
    expect(result.payload.slideDeck.title).toContain("(mock deck)");
    expect(result.payload.mode).toBe("narrated_slides");
  });

  it("does not enable mock mode for TRUE or 1", async () => {
    setRepurposeMockEnvForTests({
      vercelEnv: "preview",
      repurposeMockTts: "TRUE",
    });

    const slideDeck = {
      title: "Deck",
      slides: [
        {
          title: "One",
          bullets: ["A"],
          speakerNotes: "Narration.",
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
        : JSON.stringify({ title: "unused" });
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
      provider: "gemini-tts" as const,
    });

    const ffmpeg = vi.fn(async (args: string[]) => {
      if (args.includes("-hide_banner") && args.includes("-i")) {
        const err = new Error("probe") as Error & { stderr: string };
        err.stderr = "Duration: 00:00:03.00, start: 0.000000";
        throw err;
      }
      const outArg = args.at(-1);
      if (outArg?.endsWith(".mp4")) {
        await writeFile(outArg, Buffer.from("mock-mp4"));
      }
    });

    await generateVideoOverview({
      source,
      fetchFn,
      synthesizeFn,
      ffmpeg,
      uploadFn: vi.fn().mockResolvedValue({
        gatewayUrl: "https://example.test/v.mp4",
        uri: "lens://v",
        storageKey: "v",
      }),
      pipeline: { skipRenderPreflight: true },
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(synthesizeFn).toHaveBeenCalled();
  });
});
