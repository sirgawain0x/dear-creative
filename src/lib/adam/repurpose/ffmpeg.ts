import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type FfmpegRunner = (args: string[]) => Promise<void>;

export async function defaultFfmpegRunner(args: string[]): Promise<void> {
  await execFile("ffmpeg", args, { maxBuffer: 16 * 1024 * 1024 });
}

/** Builds a narrated slide MP4 from per-slide durations and a narration audio file. */
export async function buildNarratedSlidesMp4(input: {
  workDir: string;
  slideTitles: string[];
  secondsPerSlide: number;
  audioPath: string;
  outputPath: string;
  ffmpeg?: FfmpegRunner;
}): Promise<void> {
  const ffmpeg = input.ffmpeg ?? defaultFfmpegRunner;
  const segmentPaths: string[] = [];

  for (let i = 0; i < input.slideTitles.length; i++) {
    const title = input.slideTitles[i] ?? `Slide ${i + 1}`;
    const safe = title.replace(/'/g, "'\\''").slice(0, 120);
    const segmentPath = `${input.workDir}/slide-${i}.mp4`;
    segmentPaths.push(segmentPath);
    await ffmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x1e1b4b:s=1280x720:d=${input.secondsPerSlide}`,
      "-vf",
      `drawtext=text='${safe}':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      segmentPath,
    ]);
  }

  const listPath = `${input.workDir}/concat.txt`;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    listPath,
    segmentPaths.map((p) => `file '${p}'`).join("\n"),
    "utf8",
  );

  const silentVideo = `${input.workDir}/slides-combined.mp4`;
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
    silentVideo,
  ]);

  await ffmpeg([
    "-y",
    "-i",
    silentVideo,
    "-i",
    input.audioPath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    input.outputPath,
  ]);
}
