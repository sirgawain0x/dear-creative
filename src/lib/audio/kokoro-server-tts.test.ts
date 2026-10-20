import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KokoroTtsTimeoutError,
  synthesizeSpeechWithKokoroServer,
} from "./kokoro-server-tts";
import { NEXT_ROUTE_MAX_DURATION_SEC } from "./narration-provider";

describe("synthesizeSpeechWithKokoroServer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("sends Bearer auth and returns MP3 base64", async () => {
    vi.stubEnv("KOKORO_TTS_BASE_URL", "https://kokoro.example");
    vi.stubEnv("KOKORO_TTS_TOKEN", "secret-token");

    const fetchFn = vi.fn(async () =>
      new Response(new Uint8Array([0xff, 0xfb]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

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
        }),
      }),
    );
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.provider).toBe("kokoro-cloud-run");
  });

  it("aborts when KOKORO_TTS_TIMEOUT_MS elapses (under route maxDuration)", async () => {
    expect(NEXT_ROUTE_MAX_DURATION_SEC).toBe(300);

    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    ) as typeof fetch;

    await expect(
      synthesizeSpeechWithKokoroServer({
        text: "Slow synthesis.",
        fetchFn,
        env: {
          ...process.env,
          KOKORO_TTS_BASE_URL: "https://kokoro.example",
          KOKORO_TTS_TOKEN: "secret-token",
          KOKORO_TTS_TIMEOUT_MS: "30",
        },
      }),
    ).rejects.toBeInstanceOf(KokoroTtsTimeoutError);
  });
});
