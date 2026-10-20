import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import { describe, expect, it } from "vitest";
import { geminiTtsPayloadToMp3 } from "@/lib/audio/gemini-tts-audio";
import {
  buildNarratedSlidesMp4,
  defaultFfmpegRunner,
  probeAudioDurationSeconds,
  tailFfmpegStderrForLog,
} from "../ffmpeg";
import { synthesizeSlideNarrationMp3 } from "./audio-overview";

const execFile = promisify(execFileCb);
const ffmpegPath =
  typeof ffmpegStatic === "string" && ffmpegStatic.length > 0
    ? ffmpegStatic
    : null;

async function ffmpegSupportsDrawtext(): Promise<boolean> {
  if (!ffmpegPath) {
    return false;
  }
  try {
    const { stdout } = await execFile(ffmpegPath, ["-filters"], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return String(stdout).includes("drawtext");
  } catch {
    return false;
  }
}

function makeGeminiPcmFixture(byteLength = 24000 * 2 * 2): Buffer {
  const pcm = Buffer.alloc(byteLength);
  for (let i = 0; i < byteLength / 2; i++) {
    pcm.writeInt16LE(Math.round(Math.sin(i / 40) * 6000), i * 2);
  }
  return pcm;
}

describe("video overview PCM + ffmpeg integration", () => {
  it("rejects raw PCM written as .mp3 without normalization", async () => {
    if (!ffmpegPath) {
          return;
        }
    const workDir = await mkdtemp(join(tmpdir(), "dear-pcm-bad-"));
    const rawPath = join(workDir, "narration-0.mp3");
    await writeFile(rawPath, makeGeminiPcmFixture());

    await expect(
      probeAudioDurationSeconds({ audioPath: rawPath, ffmpeg: defaultFfmpegRunner }),
    ).rejects.toThrow(/Could not probe audio duration|ffmpeg failed/);
  });

  it("runs slide ffmpeg with Gemini-shaped PCM normalized to real MP3", async () => {
    if (!ffmpegPath) {
      return;
    }

    const pcm = makeGeminiPcmFixture();
    const mp3 = await synthesizeSlideNarrationMp3({
      text: "Slide narration fixture.",
      synthesizeFn: async () => ({
        audioBase64: pcm.toString("base64"),
        mimeType: "audio/L16;rate=24000",
        provider: "gemini-tts" as const,
      }),
    });

    const mp3Mislabeled = geminiTtsPayloadToMp3(pcm, "audio/mp3");
    expect(Array.from(mp3Mislabeled.subarray(0, 3))).not.toEqual(
      Array.from(pcm.subarray(0, 3)),
    );

    const workDir = await mkdtemp(join(tmpdir(), "dear-pcm-good-"));
    const audioPath = join(workDir, "narration-0.mp3");
    await writeFile(audioPath, mp3);

    const durationSeconds = await probeAudioDurationSeconds({
      audioPath,
      ffmpeg: defaultFfmpegRunner,
    });
    expect(durationSeconds).toBeGreaterThan(0.1);

    if (!(await ffmpegSupportsDrawtext())) {
      return;
    }

    const outputPath = join(workDir, "overview.mp4");
    await buildNarratedSlidesMp4({
      workDir,
      slides: [{ title: "Intro", audioPath, durationSeconds }],
      outputPath,
      ffmpeg: defaultFfmpegRunner,
    });

    await execFile(ffmpegPath, ["-hide_banner", "-i", outputPath], {
      maxBuffer: 4 * 1024 * 1024,
    }).catch((error: { stderr?: string }) => {
      const stderr = String(error.stderr ?? "");
      expect(stderr).toContain("Duration:");
    });
  });
});
