import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNarrationDeadline,
  NARRATION_WALL_TIMEOUT_MESSAGE,
} from "./narration-deadline";
import { synthesizeSpeechWithKokoroServer } from "./kokoro-server-tts";
import { NEXT_ROUTE_MAX_DURATION_SEC } from "./narration-provider";

describe("synthesizeSpeechWithKokoroServer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends Bearer auth and returns WAV base64", async () => {
    vi.stubEnv("KOKORO_TTS_BASE_URL", "https://kokoro.example");
    vi.stubEnv("KOKORO_TTS_TOKEN", "secret-token");

    const fetchFn = vi.fn(async () =>
      new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      }),
    ) as typeof fetch;

    const result = await synthesizeSpeechWithKokoroServer({
      text: "Hello.",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://kokoro.example/v1/synthesize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          Accept: "audio/wav",
        }),
      }),
    );
    expect(result.mimeType).toBe("audio/wav");
    expect(result.provider).toBe("kokoro-cloud-run");
  });

  it("aborts under the shared narration route wall-clock budget", async () => {
    expect(NEXT_ROUTE_MAX_DURATION_SEC).toBe(300);

    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    ) as typeof fetch;

    const deadlineAtMs = createNarrationDeadline(30, Date.now());

    await expect(
      synthesizeSpeechWithKokoroServer({
        text: "Slow synthesis.",
        fetchFn,
        deadlineAtMs,
        env: {
          ...process.env,
          KOKORO_TTS_BASE_URL: "https://kokoro.example",
          KOKORO_TTS_TOKEN: "secret-token",
        },
      }),
    ).rejects.toThrow(NARRATION_WALL_TIMEOUT_MESSAGE);
  });
});
