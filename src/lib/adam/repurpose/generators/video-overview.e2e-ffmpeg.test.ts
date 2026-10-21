import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodePcmToMp3 } from "@/lib/audio/narration";
import { generateVideoOverview } from "./video-overview";

const execFile = promisify(execFileCb);
const ffmpegPath =
  typeof ffmpegStatic === "string" && ffmpegStatic.length > 0
    ? ffmpegStatic
    : null;

const workDirs: string[] = [];

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    workDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function makeMonoPcm(seconds = 1, sampleRate = 24000): Buffer {
  const samples = Math.floor(seconds * sampleRate);
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    pcm.writeInt16LE(Math.round(Math.sin(i / 30) * 8000), i * 2);
  }
  return pcm;
}

describe("generateVideoOverview ffmpeg e2e (mock TTS)", () => {
  it("produces a valid MP4 when TTS is mocked with real MP3 bytes", async () => {
    if (!ffmpegPath) {
      return;
    }

    const slideDeck = {
      title: "Deck",
      slides: [
        { title: "Alpha", bullets: ["A"], speakerNotes: "First." },
        { title: "Beta", bullets: ["B"], speakerNotes: "Second." },
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

    const synthesizeFn = vi.fn(async () => {
      const mp3 = encodePcmToMp3(makeMonoPcm(0.75), 24000, 1);
      return {
        audioBase64: mp3.toString("base64"),
        mimeType: "audio/mp3",
        provider: "gemini-tts" as const,
      };
    });

    const artifactDir = await mkdtemp(join(tmpdir(), "dear-video-artifact-"));
    workDirs.push(artifactDir);

    const uploadFn = vi.fn(async (file: Blob | File) => {
      const buf = Buffer.from(await file.arrayBuffer());
      const artifactPath = join(artifactDir, "overview-e2e.mp4");
      await writeFile(artifactPath, buf);
      return {
        gatewayUrl: `file://${artifactPath}`,
        uri: "lens://local",
        storageKey: "local",
      };
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
      uploadFn,
      pipeline: { skipRenderPreflight: false },
    });

    expect(synthesizeFn).toHaveBeenCalledTimes(2);
    expect(result.mediaMimeType).toBe("video/mp4");

    const artifactPath = join(artifactDir, "overview-e2e.mp4");
    await execFile(ffmpegPath, ["-hide_banner", "-i", artifactPath], {
      maxBuffer: 4 * 1024 * 1024,
    }).catch((error: { stderr?: string }) => {
      const stderr = String(error.stderr ?? "");
      expect(stderr).toContain("Duration:");
      expect(stderr).toMatch(/Video:/);
      expect(stderr).toMatch(/Audio:/);
    });
  });
});
