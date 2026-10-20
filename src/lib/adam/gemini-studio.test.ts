import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ADAM_GEMINI_VIDEO_MODEL,
  DEFAULT_ADAM_IMAGEN_MODEL,
  generateBannerWithGemini,
  generateVideoWithVeo,
} from "./gemini-studio";

const mockUpload = vi.fn(async () => ({
  uri: "lens://asset1",
  gatewayUrl: "https://api.grove.storage/asset1",
  storageKey: "asset1",
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("generateVideoWithVeo (Gemini Omni default)", () => {
  it("uses gemini-omni-1.1-flash on the Interactions API by default", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fakeMp4 = Buffer.from("fake-mp4").toString("base64");
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("/v1beta/interactions");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe(DEFAULT_ADAM_GEMINI_VIDEO_MODEL);
      expect(body.input).toEqual([
        { type: "text", text: "A calm creative studio at dusk" },
      ]);
      expect(body.response_format).toEqual({
        type: "video",
        aspect_ratio: "16:9",
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
    });
  });

  it("polls Gemini Files when the interaction returns a video URI", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fileId = "abc123";
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/interactions")) {
        return new Response(
          JSON.stringify({
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
      if (url.includes(`/files/${fileId}?`)) {
        return new Response(JSON.stringify({ state: "ACTIVE" }), {
          status: 200,
        });
      }
      if (url.includes(`/files/${fileId}:download`)) {
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
    });

    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes(":download"))).toBe(
      true,
    );
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
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe(DEFAULT_ADAM_IMAGEN_MODEL);
        expect(body.input).toEqual([
          { type: "text", text: expect.stringContaining("Neon studio") },
        ]);
        expect(body.response_format).toMatchObject({
          type: "image",
          aspect_ratio: "16:9",
        });
        return new Response(
          JSON.stringify({
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
    });

    expect(result.provider).toBe("nano-banana");
  });
});
