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

const execFile = promisify(execFileCb);

export type FfmpegRunner = (args: string[]) => Promise<void>;

export function resolveFfmpegBinaryPath(): string {
  const bundled = ffmpegStatic;
  if (typeof bundled === "string" && bundled.length > 0) {
    return bundled;
  }
  return "ffmpeg";
}

export function resolveRepurposeDrawtextFontPath(): string {
  return join(process.cwd(), "src/assets/fonts/DejaVuSans.ttf");
}

export async function defaultFfmpegRunner(args: string[]): Promise<void> {
  const binary = resolveFfmpegBinaryPath();
  await execFile(binary, args, {
    maxBuffer: 16 * 1024 * 1024,
    timeout: REPURPOSE_FFMPEG_EXEC_TIMEOUT_MS,
  });
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
        : "";
    const duration = parseDurationSecondsFromProbeStderr(stderr);
    if (duration !== null) {
      return duration;
    }
    throw new Error("Could not probe audio duration");
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
    const binary = resolveFfmpegBinaryPath();
    await execFile(binary, args, {
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    });
  };
}

/** Builds a narrated slide MP4; one segment per slide timed to its narration. */
export async function buildNarratedSlidesMp4(input: {
  workDir: string;
  slides: SlideNarrationSpec[];
  outputPath: string;
  ffmpeg?: FfmpegRunner;
}): Promise<void> {
  if (input.slides.length === 0) {
    throw new Error("No slides for video overview.");
  }

  const ffmpeg = input.ffmpeg ?? defaultFfmpegRunner;
  const fontfile = resolveRepurposeDrawtextFontPath();
  const segmentPaths: string[] = [];

  for (let i = 0; i < input.slides.length; i++) {
    const slide = input.slides[i]!;
    const duration = Math.max(0.5, slide.durationSeconds);
    const textPath = join(input.workDir, `slide-${i}.txt`);
    await writeFile(textPath, slide.title.slice(0, 200), "utf8");
    const segmentPath = join(input.workDir, `slide-${i}.mp4`);
    segmentPaths.push(segmentPath);

    await ffmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x1e1b4b:s=1280x720:d=${duration}`,
      "-i",
      slide.audioPath,
      "-vf",
      `drawtext=fontfile=${fontfile}:textfile=${textPath}:expansion=none:fontsize=42:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
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

/** Runs ffmpeg -version for diagnostics (auth-gated route). */
export async function getFfmpegVersionLine(): Promise<{
  binary: string;
  versionLine: string;
}> {
  const binary = resolveFfmpegBinaryPath();
  const { stdout, stderr } = await execFile(binary, ["-version"], {
    maxBuffer: 512 * 1024,
    timeout: 15_000,
  });
  const text = `${stdout}\n${stderr}`.trim();
  const versionLine = text.split("\n").find((line) => line.length > 0) ?? "";
  if (!versionLine) {
    throw new Error("ffmpeg -version returned no output");
  }
  return { binary, versionLine };
}
