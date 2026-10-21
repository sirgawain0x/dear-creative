import { execFile as execFileCb } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { RepurposeInfrastructureError } from "./repurpose-infrastructure-error";
import {
  renderSlideTitlePng,
  resetRepurposeSlideFontCacheForTests,
} from "./slide-image";
import { resolveFfmpegBinaryPath } from "./ffmpeg";

const execFile = promisify(execFileCb);

export const REPURPOSE_PREFLIGHT_CODE = {
  FFMPEG_MISSING: "repurpose_ffmpeg_missing",
  FFMPEG_ENCODER: "repurpose_ffmpeg_encoder_missing",
  FFMPEG_FILTER: "repurpose_ffmpeg_filter_missing",
  SLIDE_RENDER: "repurpose_slide_render_failed",
} as const;

export type RepurposeVideoPreflightResult = {
  ffmpegVersionLine: string;
  encodersChecked: string[];
  filtersChecked: string[];
  slideRenderMs: number;
};

const REQUIRED_ENCODERS = ["libx264", "aac"] as const;
const REQUIRED_FILTERS = ["concat"] as const;

async function execFfmpegCapture(args: string[]): Promise<string> {
  const binary = resolveFfmpegBinaryPath();
  try {
    const { stdout, stderr } = await execFile(binary, args, {
      maxBuffer: 8 * 1024 * 1024,
      timeout: 15_000,
    });
    return `${stdout}\n${stderr}`;
  } catch (error) {
    if (error && typeof error === "object" && "stdout" in error) {
      return `${String((error as { stdout: string }).stdout)}\n${String((error as { stderr?: string }).stderr ?? "")}`;
    }
    throw error;
  }
}

function assertCapabilityPresent(
  haystack: string,
  needle: string,
  kind: "encoder" | "filter",
): void {
  if (!haystack.includes(needle)) {
    const code =
      kind === "encoder"
        ? REPURPOSE_PREFLIGHT_CODE.FFMPEG_ENCODER
        : REPURPOSE_PREFLIGHT_CODE.FFMPEG_FILTER;
    throw new RepurposeInfrastructureError(
      503,
      "Video overview rendering is unavailable on this deployment.",
      code,
      `Missing ffmpeg ${kind}: ${needle}`,
    );
  }
}

/** Verifies ffmpeg encoders/filters and slide PNG rendering before paid TTS. */
export async function runRepurposeVideoRenderPreflight(): Promise<RepurposeVideoPreflightResult> {
  const binary = resolveFfmpegBinaryPath();
  if (!binary) {
    throw new RepurposeInfrastructureError(
      503,
      "Video overview rendering is unavailable on this deployment.",
      REPURPOSE_PREFLIGHT_CODE.FFMPEG_MISSING,
      "ffmpeg binary path is empty",
    );
  }

  let versionLine = "";
  try {
    const versionOut = await execFfmpegCapture(["-hide_banner", "-version"]);
    versionLine = versionOut.split("\n")[0]?.trim() ?? "";
  } catch (error) {
    throw new RepurposeInfrastructureError(
      503,
      "Video overview rendering is unavailable on this deployment.",
      REPURPOSE_PREFLIGHT_CODE.FFMPEG_MISSING,
      error instanceof Error ? error.message : "ffmpeg -version failed",
    );
  }

  const encodersOut = await execFfmpegCapture(["-hide_banner", "-encoders"]);
  for (const encoder of REQUIRED_ENCODERS) {
    assertCapabilityPresent(encodersOut, encoder, "encoder");
  }

  const filtersOut = await execFfmpegCapture(["-hide_banner", "-filters"]);
  for (const filter of REQUIRED_FILTERS) {
    assertCapabilityPresent(filtersOut, filter, "filter");
  }

  const slideStart = Date.now();
  const workDir = await mkdtemp(join(tmpdir(), "dear-repurpose-preflight-"));
  const pngPath = join(workDir, "preflight-slide.png");
  try {
    await renderSlideTitlePng({ title: "Preflight", outputPath: pngPath });
  } catch (error) {
    throw new RepurposeInfrastructureError(
      503,
      "Video overview rendering is unavailable on this deployment.",
      REPURPOSE_PREFLIGHT_CODE.SLIDE_RENDER,
      error instanceof Error ? error.message : "slide PNG render failed",
    );
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return {
    ffmpegVersionLine: versionLine,
    encodersChecked: [...REQUIRED_ENCODERS],
    filtersChecked: [...REQUIRED_FILTERS],
    slideRenderMs: Date.now() - slideStart,
  };
}

/** @internal */
export function resetRepurposeVideoPreflightCachesForTests(): void {
  resetRepurposeSlideFontCacheForTests();
}
