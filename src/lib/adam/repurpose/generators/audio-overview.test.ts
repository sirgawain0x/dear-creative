import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAudioOverviewMp3 } from "./audio-overview";

describe("buildAudioOverviewMp3", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses one multi-speaker TTS call for the full script", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "Show",
                      segments: [
                        { speaker: "host_a", text: "Hello listeners." },
                        { speaker: "host_b", text: "Great topic today." },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const synthesizeMultiSpeakerFn = vi.fn().mockResolvedValue({
      audioBase64: Buffer.from("fake-mp3").toString("base64"),
      mimeType: "audio/mp3",
      provider: "mock",
    });

    const { script, mp3 } = await buildAudioOverviewMp3({
      source: {
        id: "p1",
        slug: "pod",
        title: "Pod",
        status: "published",
        authorId: "author-1",
        teaserText: null,
        plainText: "Article body",
      },
      fetchFn,
      synthesizeMultiSpeakerFn,
    });

    expect(script.segments).toHaveLength(2);
    expect(synthesizeMultiSpeakerFn).toHaveBeenCalledTimes(1);
    expect(synthesizeMultiSpeakerFn.mock.calls[0]?.[0]?.segments).toHaveLength(
      2,
    );
    expect(mp3.length).toBeGreaterThan(0);
  });

  it("encodes mislabeled Gemini PCM (audio/mp3) into valid MP3 bytes", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const pcm = Buffer.alloc(4800);
    for (let i = 0; i < pcm.length / 2; i++) {
      pcm.writeInt16LE(100, i * 2);
    }
    const synthesizeMultiSpeakerFn = vi.fn().mockResolvedValue({
      audioBase64: pcm.toString("base64"),
      mimeType: "audio/mp3",
      provider: "mock",
    });

    const { mp3 } = await buildAudioOverviewMp3({
      source: {
        id: "p1",
        slug: "pod",
        title: "Pod",
        status: "published",
        authorId: "author-1",
        teaserText: null,
        plainText: "Article body",
      },
      fetchFn: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        segments: [{ speaker: "host_a", text: "Hello." }],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
      synthesizeMultiSpeakerFn,
    });

    expect(mp3[0]).toBe(0xff);
    expect(mp3[1]! & 0xe0).toBe(0xe0);
  });
});
