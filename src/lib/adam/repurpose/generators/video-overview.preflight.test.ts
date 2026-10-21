import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REPURPOSE_PREFLIGHT_CODE,
  runRepurposeVideoRenderPreflight,
} from "../ffmpeg-preflight";
import { RepurposeInfrastructureError } from "../repurpose-infrastructure-error";

vi.mock("../ffmpeg-preflight", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ffmpeg-preflight")>();
  return {
    ...actual,
    runRepurposeVideoRenderPreflight: vi.fn(actual.runRepurposeVideoRenderPreflight),
  };
});

describe("generateVideoOverview render preflight", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not call TTS when preflight fails", async () => {
    vi.mocked(runRepurposeVideoRenderPreflight).mockRejectedValueOnce(
      new RepurposeInfrastructureError(
        503,
        "Video overview rendering is unavailable on this deployment.",
        REPURPOSE_PREFLIGHT_CODE.FFMPEG_ENCODER,
        "Missing ffmpeg encoder: libx264",
      ),
    );

    const { generateVideoOverview } = await import("./video-overview");
    const synthesizeFn = vi.fn();
    const slideDeck = {
      title: "Deck",
      slides: [{ title: "One", bullets: ["A"], speakerNotes: "Narration." }],
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

    await expect(
      generateVideoOverview({
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
        ffmpeg: vi.fn(),
        uploadFn: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(RepurposeInfrastructureError);

    expect(synthesizeFn).not.toHaveBeenCalled();
  });
});
