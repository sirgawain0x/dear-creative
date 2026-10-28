import { execFile as execFileCb } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  REPURPOSE_SLIDE_BACKGROUND,
  REPURPOSE_SLIDE_HEIGHT,
  REPURPOSE_SLIDE_WIDTH,
  resolveRepurposeSlideFontPath,
  wrapSlideTitleLines,
} from "./slide-image";
import { resolveFfmpegBinaryPath } from "./ffmpeg";

const execFile = promisify(execFileCb);

/** ffmpeg-static omits drawtext; libass `ass` + fontsdir uses bundled TTF explicitly. */
export function resolveRepurposeFontsDir(): string {
  return join(process.cwd(), "src/assets/fonts");
}

export function escapeAssDialogueText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

export function buildSlideAssContent(title: string): string {
  const lines = wrapSlideTitleLines(title.slice(0, 200));
  const dialogueText = lines.map(escapeAssDialogueText).join("\\N");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${REPURPOSE_SLIDE_WIDTH}
PlayResY: ${REPURPOSE_SLIDE_HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,42,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,0,0,5,48,48,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:30.00,Default,,0,0,0,,${dialogueText}
`;
}

export function buildSlideAssVideoFilter(input: {
  assPath: string;
  fontsDir?: string;
}): string {
  const fontsDir = input.fontsDir ?? resolveRepurposeFontsDir();
  const escapePath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:");
  return `ass=${escapePath(input.assPath)}:fontsdir=${escapePath(fontsDir)}`;
}

export function slideColorSourceSpec(): string {
  const hex = REPURPOSE_SLIDE_BACKGROUND.replace("#", "0x");
  return `color=c=${hex}:s=${REPURPOSE_SLIDE_WIDTH}x${REPURPOSE_SLIDE_HEIGHT}:r=24`;
}

export async function writeSlideAssFile(input: {
  title: string;
  assPath: string;
}): Promise<void> {
  await writeFile(input.assPath, buildSlideAssContent(input.title), "utf8");
}

/** Renders a single PNG frame with ffmpeg ass + bundled font (serverless-safe). */
export async function renderSlideTitleFramePng(input: {
  title: string;
  outputPath: string;
  assPath?: string;
}): Promise<void> {
  const binary = resolveFfmpegBinaryPath();
  const assPath =
    input.assPath ??
    join(
      input.outputPath.replace(/[^/]+$/, ""),
      `frame-${Date.now()}.ass`,
    );
  await writeSlideAssFile({ title: input.title, assPath });
  const vf = buildSlideAssVideoFilter({ assPath });
  await execFile(
    binary,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      slideColorSourceSpec(),
      "-vf",
      vf,
      "-frames:v",
      "1",
      "-update",
      "1",
      input.outputPath,
    ],
    { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 },
  );
}

/** @deprecated use resolveRepurposeFontsDir — kept for tests referencing font file path */
export function resolveBundledRepurposeFontFile(): string {
  return resolveRepurposeSlideFontPath();
}
