import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { encodePcmToMp3 } from "@/lib/audio/narration";
import { resolveFfmpegBinaryPath } from "./ffmpeg";
import type { RepurposePostSource } from "./post-source";
import { validateRepurposeModelOutput } from "./validate-output";

const execFile = promisify(execFileCb);

let vercelEnvOverride: string | undefined;
let repurposeMockTtsEnvOverride: string | undefined;
let mockModeLogged = false;

/** @internal */
export function setRepurposeMockEnvForTests(input: {
  vercelEnv?: string;
  repurposeMockTts?: string;
}): void {
  vercelEnvOverride = input.vercelEnv;
  repurposeMockTtsEnvOverride = input.repurposeMockTts;
}

/** @internal */
export function resetRepurposeMockEnvForTests(): void {
  vercelEnvOverride = undefined;
  repurposeMockTtsEnvOverride = undefined;
  mockModeLogged = false;
  cachedSilentMp3 = null;
}

function readVercelEnv(): string | undefined {
  return vercelEnvOverride ?? process.env.VERCEL_ENV;
}

function readRepurposeMockTtsEnv(): string | undefined {
  return repurposeMockTtsEnvOverride ?? process.env.REPURPOSE_MOCK_TTS;
}

/**
 * Preview/local $0 video_overview path.
 * Enabled only when VERCEL_ENV is not exactly "production" and REPURPOSE_MOCK_TTS === "true".
 */
export function isRepurposeMockEnabled(): boolean {
  if (readVercelEnv() === "production") {
    return false;
  }
  return readRepurposeMockTtsEnv() === "true";
}

export function logRepurposeMockModeOnce(): void {
  if (mockModeLogged || !isRepurposeMockEnabled()) {
    return;
  }
  mockModeLogged = true;
  console.info("[repurpose] mock mode active (REPURPOSE_MOCK_TTS, non-production)", {
    vercelEnv: readVercelEnv() ?? null,
  });
}

export function getMockVideoOverviewSlideDeck(source: RepurposePostSource) {
  const title = source.title?.trim() || "Preview overview";
  return validateRepurposeModelOutput("slide_deck", {
    title: `${title} (mock deck)`,
    slides: [
      {
        title: "Mock slide one",
        bullets: ["Deterministic preview content"],
        speakerNotes: "Silent mock narration for slide one.",
      },
      {
        title: "Mock slide two",
        bullets: ["No Gemini calls"],
        speakerNotes: "Silent mock narration for slide two.",
      },
    ],
  });
}

let cachedSilentMp3: Buffer | null = null;

const MOCK_NARRATION_SAMPLE_RATE = 24_000;
const MOCK_NARRATION_DURATION_SECONDS = 3;

/** Silent valid MP3 via ffmpeg anullsrc PCM + lamejs encode (no Gemini TTS). */
export async function generateMockSilentNarrationMp3(): Promise<Buffer> {
  if (cachedSilentMp3) {
    return cachedSilentMp3;
  }

  const binary = resolveFfmpegBinaryPath();
  const { stdout } = (await execFile(
    binary,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${MOCK_NARRATION_SAMPLE_RATE}:cl=mono`,
      "-t",
      String(MOCK_NARRATION_DURATION_SECONDS),
      "-f",
      "s16le",
      "-acodec",
      "pcm_s16le",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: MOCK_NARRATION_SAMPLE_RATE * 2 * MOCK_NARRATION_DURATION_SECONDS + 4096,
      timeout: 15_000,
    },
  )) as { stdout: Buffer };

  const pcm = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const mp3 = encodePcmToMp3(pcm, MOCK_NARRATION_SAMPLE_RATE, 1);
  cachedSilentMp3 = mp3;
  return mp3;
}
