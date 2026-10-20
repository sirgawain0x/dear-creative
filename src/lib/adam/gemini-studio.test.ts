import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADAM_VIDEO_DEFAULT_FETCH_TIMEOUT_MS,
  ADAM_VIDEO_DEFAULT_POLL_INTERVAL_MS,
  ADAM_VIDEO_ROUTE_BUDGET_MS,
  DEFAULT_ADAM_GEMINI_VIDEO_MODEL,
  DEFAULT_ADAM_IMAGEN_MODEL,
  computeAdamVideoPollAttempts,
  generateBannerWithGemini,
  generateVideoWithVeo,
} from "./gemini-studio";

const mockUpload = vi.fn(async () => ({
  uri: "lens://asset1",
  gatewayUrl: "https://api.grove.storage/asset1",
  storageKey: "asset1",
}));

function geminiHeaders(init?: RequestInit): Headers {
  return new Headers(init?.headers as HeadersInit | undefined);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("computeAdamVideoPollAttempts", () => {
  it("sizes polling to fit within the 300s route budget", () => {
    const attempts = computeAdamVideoPollAttempts();
    const reserve = ADAM_VIDEO_DEFAULT_FETCH_TIMEOUT_MS * 3;
    const totalMs =
      attempts * ADAM_VIDEO_DEFAULT_POLL_INTERVAL_MS + reserve;
    expect(totalMs).toBeLessThanOrEqual(ADAM_VIDEO_ROUTE_BUDGET_MS);
    expect(totalMs).toBeLessThanOrEqual(300_000);
  });
});

describe("generateVideoWithVeo (Gemini Omni default)", () => {
  it("uses Interactions with delivery uri and x-goog-api-key header", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fakeMp4 = Buffer.from("fake-mp4").toString("base64");
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("/v1beta/interactions");
      expect(String(url)).not.toContain("key=");
      expect(geminiHeaders(init).get("x-goog-api-key")).toBe("test-key");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe(DEFAULT_ADAM_GEMINI_VIDEO_MODEL);
      expect(body.response_format).toEqual({
        type: "video",
        aspect_ratio: "16:9",
        delivery: "uri",
      });
      return new Response(
        JSON.stringify({
          status: "completed",
          model: DEFAULT_ADAM_GEMINI_VIDEO_MODEL,
          steps: [
            {
              type: "model_output",
              content: [
                { type: "video", mime_type: "video/mp4", data: fakeMp4 },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await generateVideoWithVeo({
      prompt: "A calm creative studio at dusk",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      maxPollAttempts: 1,
      pollIntervalMs: 0,
      fetchTimeoutMs: 5_000,
    });

    expect(result.provider).toBe("gemini-omni");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("honors ADAM_GEMINI_VIDEO_MODEL for Interactions requests", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("ADAM_GEMINI_VIDEO_MODEL", "gemini-omni-flash-preview");
    const fakeMp4 = Buffer.from("vid").toString("base64");
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gemini-omni-flash-preview");
      return new Response(
        JSON.stringify({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "video", data: fakeMp4 }],
            },
          ],
        }),
        { status: 200 },
      );
    });

    await generateVideoWithVeo({
      prompt: "Test override",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      pollIntervalMs: 0,
      fetchTimeoutMs: 5_000,
    });
  });

  it("polls Gemini Files when the interaction returns a video URI", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fileId = "abc123";
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).not.toContain("key=");
      if (url.includes("/interactions")) {
        expect(geminiHeaders(init).get("x-goog-api-key")).toBe("test-key");
        return new Response(
          JSON.stringify({
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [
                  {
                    type: "video",
                    mime_type: "video/mp4",
                    uri: `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?alt=media`,
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith(`/files/${fileId}`)) {
        expect(geminiHeaders(init).get("x-goog-api-key")).toBe("test-key");
        return new Response(JSON.stringify({ state: "ACTIVE" }), {
          status: 200,
        });
      }
      if (url.includes(`/files/${fileId}:download`)) {
        expect(geminiHeaders(init).get("x-goog-api-key")).toBe("test-key");
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await generateVideoWithVeo({
      prompt: "URI delivery clip",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      maxPollAttempts: 2,
      pollIntervalMs: 0,
      fetchTimeoutMs: 5_000,
    });

    expect(
      mockFetch.mock.calls.some((c) => String(c[0]).includes(":download")),
    ).toBe(true);
  });

  it("throws and logs status when the interaction HTTP response is not OK", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn(async () => new Response("nope", { status: 503 }));

    await expect(
      generateVideoWithVeo({
        prompt: "Fail HTTP",
        fetchFn: mockFetch as unknown as typeof fetch,
        uploadFn: mockUpload,
        fetchTimeoutMs: 5_000,
      }),
    ).rejects.toThrow(/503/);

    expect(errorSpy).toHaveBeenCalledWith("Gemini HTTP 503");
  });

  it("throws when interaction status is not completed", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ status: "in_progress", steps: [] }),
        { status: 200 },
      ),
    );

    await expect(
      generateVideoWithVeo({
        prompt: "Pending",
        fetchFn: mockFetch as unknown as typeof fetch,
        uploadFn: mockUpload,
        fetchTimeoutMs: 5_000,
      }),
    ).rejects.toThrow(/not completed/i);
  });

  it("throws when Gemini file processing fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fileId = "failed-file";
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/interactions")) {
        return new Response(
          JSON.stringify({
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [
                  {
                    type: "video",
                    uri: `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?alt=media`,
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith(`/files/${fileId}`)) {
        return new Response(JSON.stringify({ state: "FAILED" }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      generateVideoWithVeo({
        prompt: "File fail",
        fetchFn: mockFetch as unknown as typeof fetch,
        uploadFn: mockUpload,
        maxPollAttempts: 1,
        pollIntervalMs: 0,
        fetchTimeoutMs: 5_000,
      }),
    ).rejects.toThrow(/file processing failed/i);
  });

  it("uses legacy Veo predictLongRunning when ADAM_GEMINI_VIDEO_MODEL is veo-*", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("ADAM_GEMINI_VIDEO_MODEL", "veo-3.0-generate-001");
    const fakeMp4 = Buffer.from("legacy").toString("base64");

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("predictLongRunning")) {
        const body = JSON.parse(String(init?.body));
        expect(body.instances[0].prompt).toBe("Legacy veo path");
        expect(body.parameters.aspectRatio).toBe("9:16");
        return new Response(
          JSON.stringify({
            name: "operations/veo-legacy",
            done: true,
            response: {
              generateVideoResponse: {
                generatedSamples: [
                  {
                    video: {
                      bytesBase64Encoded: fakeMp4,
                      mimeType: "video/mp4",
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await generateVideoWithVeo({
      prompt: "Legacy veo path",
      aspectRatio: "9:16",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      pollIntervalMs: 0,
    });

    expect(result.provider).toBe("veo");
    expect(String(mockFetch.mock.calls[0][0])).toContain("predictLongRunning");
  });
});

describe("generateBannerWithGemini (Nano Banana fallback)", () => {
  it("falls back to gemini-nano-banana-2.1 via Interactions when primary image fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fakePng = Buffer.from("png-bytes").toString("base64");

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("generateContent")) {
        return new Response(JSON.stringify({ candidates: [] }), {
          status: 200,
        });
      }
      if (url.includes("/interactions")) {
        expect(String(url)).not.toContain("key=");
        expect(geminiHeaders(init).get("x-goog-api-key")).toBe("test-key");
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe(DEFAULT_ADAM_IMAGEN_MODEL);
        expect(body.response_format).toMatchObject({
          type: "image",
          aspect_ratio: "16:9",
        });
        return new Response(
          JSON.stringify({
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [
                  { type: "image", mime_type: "image/png", data: fakePng },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await generateBannerWithGemini({
      prompt: "Neon studio workspace",
      title: "Test Banner",
      aspectRatio: "16:9",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      fetchTimeoutMs: 5_000,
    });

    expect(result.provider).toBe("nano-banana");
  });

  it("honors ADAM_IMAGEN_MODEL for the Nano Banana fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("ADAM_IMAGEN_MODEL", "gemini-3.1-flash-image");
    const fakePng = Buffer.from("png").toString("base64");

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("generateContent")) {
        return new Response("{}", { status: 500 });
      }
      if (url.includes("/interactions")) {
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe("gemini-3.1-flash-image");
        return new Response(
          JSON.stringify({
            status: "completed",
            output_image: { data: fakePng, mime_type: "image/png" },
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await generateBannerWithGemini({
      prompt: "Override model banner",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      fetchTimeoutMs: 5_000,
    });

    expect(result.provider).toBe("nano-banana");
  });

  it("falls back to SVG when the image interaction HTTP response is not OK", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("generateContent")) {
        return new Response(JSON.stringify({ candidates: [] }), {
          status: 200,
        });
      }
      if (url.includes("/interactions")) {
        return new Response("fail", { status: 429 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await generateBannerWithGemini({
      prompt: "HTTP fail banner",
      fetchFn: mockFetch as unknown as typeof fetch,
      uploadFn: mockUpload,
      fetchTimeoutMs: 5_000,
    });

    expect(result.provider).toBe("deterministic-svg");
    expect(errorSpy).toHaveBeenCalledWith("Gemini HTTP 429");
  });
});
