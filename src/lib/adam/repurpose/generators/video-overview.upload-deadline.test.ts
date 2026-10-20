import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REPURPOSE_PER_CALL_TIMEOUT_MESSAGE } from "../pipeline-deadline";
import { generateVideoOverview } from "./video-overview";

describe("generateVideoOverview upload deadline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("aborts a hung Lens Grove upload when the per-call cap fires", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(0);
    let now = 0;

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
      if (args.includes("-hide_banner") && args.includes("-i")) {
        const err = new Error("probe") as Error & { stderr: string };
        err.stderr = "Duration: 00:00:04.00, start: 0.000000";
        throw err;
      }
      const outArg = args.at(-1);
      if (outArg?.endsWith(".mp4")) {
        await writeFile(outArg, Buffer.from("mock-mp4"));
      }
    });

    const uploadFn = vi.fn(
      (_blob: Blob, _name?: string, signal?: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const promise = generateVideoOverview({
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
      pipeline: {
        deadlineAtMs: 10_000,
        nowFn: () => now,
        uploadPerCallCapMs: 50,
        deckPerFetchCapMs: 5_000,
        ttsPerFetchCapMs: 5_000,
      },
    });

    const rejection = expect(promise).rejects.toThrow(
      REPURPOSE_PER_CALL_TIMEOUT_MESSAGE,
    );
    now = 100;
    await vi.runAllTimersAsync();
    await rejection;
    expect(uploadFn).toHaveBeenCalled();
  });
});
