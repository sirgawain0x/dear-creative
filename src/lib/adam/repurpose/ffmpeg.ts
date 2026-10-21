import { execFile as execFileCb } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { promisify } from "node:util";
import { REPURPOSE_FFMPEG_EXEC_TIMEOUT_MS } from "./constants";
import {
  assertRepurposePipelineBudget,
  remainingRepurposePipelineMs,
} from "./pipeline-deadline";
import { renderSlideTitlePng } from "./slide-image";

const execFile = promisify(execFileCb);

export type FfmpegRunner = (args: string[]) => Promise<void>;

const FFMPEG_STDERR_TAIL_BYTES = 2048;

export function tailFfmpegStderrForLog(stderr: string): string {
  const bytes = Buffer.from(stderr, "utf8");
  if (bytes.length <= FFMPEG_STDERR_TAIL_BYTES) {
    return stderr;
  }
  return bytes.subarray(bytes.length - FFMPEG_STDERR_TAIL_BYTES).toString("utf8");
}

function rethrowFfmpegExecError(error: unknown): never {
  if (error && typeof error === "object" && "stderr" in error) {
    const stderr = tailFfmpegStderrForLog(String((error as { stderr: string }).stderr));
    throw new Error(`ffmpeg failed: ${stderr}`);
  }
  throw error;
}

export function resolveFfmpegBinaryPath(): string {
  const bundled = ffmpegStatic;
  if (typeof bundled === "string" && bundled.length > 0) {
    return bundled;
  }
  return "ffmpeg";
}

async function execFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  const binary = resolveFfmpegBinaryPath();
  try {
    await execFile(binary, args, {
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
      env: process.env,
    });
  } catch (error) {
    rethrowFfmpegExecError(error);
  }
}

export async function defaultFfmpegRunner(args: string[]): Promise<void> {
  await execFfmpeg(args, REPURPOSE_FFMPEG_EXEC_TIMEOUT_MS);
}

const durationRe = /Duration:\s(\d+):(\d+):(\d+(?:\.\d+)?)/;

function parseDurationSecondsFromProbeStderr(stderr: string): number | null {
  const match = durationRe.exec(stderr);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

async function runFfmpegProbe(
  runner: (args: string[]) => Promise<void>,
  audioPath: string,
): Promise<number> {
  try {
    await runner(["-hide_banner", "-i", audioPath]);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr: string }).stderr)
        : error instanceof Error
          ? error.message
          : "";
    const duration = parseDurationSecondsFromProbeStderr(stderr);
    if (duration !== null) {
      return duration;
    }
    if (error instanceof Error && error.message.startsWith("ffmpeg failed:")) {
      throw error;
    }
    throw new Error(
      `Could not probe audio duration: ${tailFfmpegStderrForLog(stderr)}`,
    );
  }
  throw new Error("Could not probe audio duration");
}

/** Reads audio duration via ffmpeg -i (stderr). */
export async function probeAudioDurationSeconds(input: {
  audioPath: string;
  ffmpeg?: FfmpegRunner;
}): Promise<number> {
  const runner = input.ffmpeg ?? defaultFfmpegRunner;
  return runFfmpegProbe(runner, input.audioPath);
}

export type SlideNarrationSpec = {
  title: string;
  audioPath: string;
  durationSeconds: number;
};

export function createDeadlineAwareFfmpegRunner(input: {
  deadlineAtMs: number;
  nowFn?: () => number;
  inner?: FfmpegRunner;
}): FfmpegRunner {
  const inner = input.inner ?? defaultFfmpegRunner;
  const nowFn = input.nowFn ?? Date.now;
  return async (args: string[]) => {
    assertRepurposePipelineBudget(input.deadlineAtMs, nowFn());
    if (input.inner) {
      return inner(args);
    }
    const remaining = remainingRepurposePipelineMs(input.deadlineAtMs, nowFn());
    const timeoutMs = Math.min(
      REPURPOSE_FFMPEG_EXEC_TIMEOUT_MS,
      Math.max(1_000, remaining),
    );
    await execFfmpeg(args, timeoutMs);
  };
}

/** Builds a narrated slide MP4 from PNG stills + narration audio per slide. */
export async function buildNarratedSlidesMp4(input: {
  workDir: string;
  slides: SlideNarrationSpec[];
  outputPath: string;
  ffmpeg?: FfmpegRunner;
  renderSlidePng?: (slide: {
    title: string;
    outputPath: string;
  }) => Promise<void>;
}): Promise<void> {
  if (input.slides.length === 0) {
    throw new Error("No slides for video overview.");
  }

  const ffmpeg = input.ffmpeg ?? defaultFfmpegRunner;
  const renderSlide =
    input.renderSlidePng ??
    (async (slide: { title: string; outputPath: string }) => {
      await renderSlideTitlePng(slide);
    });
  const segmentPaths: string[] = [];

  for (let i = 0; i < input.slides.length; i++) {
    const slide = input.slides[i]!;
    const pngPath = join(input.workDir, `slide-${i}.png`);
    await renderSlide({ title: slide.title, outputPath: pngPath });
    const segmentPath = join(input.workDir, `slide-${i}.mp4`);
    segmentPaths.push(segmentPath);

    await ffmpeg([
      "-y",
      "-loop",
      "1",
      "-i",
      pngPath,
      "-i",
      slide.audioPath,
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-tune",
      "stillimage",
      "-c:a",
      "aac",
      segmentPath,
    ]);
  }

  const listPath = join(input.workDir, "concat.txt");
  await writeFile(
    listPath,
    segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8",
  );

  await ffmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    input.outputPath,
  ]);
}
