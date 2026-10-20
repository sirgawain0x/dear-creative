import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { generateTextRepurposeOutput } from "./text";
import { buildAudioOverviewMp3 } from "./audio-overview";
import type { RepurposePostSource } from "../post-source";
import { buildNarratedSlidesMp4, type FfmpegRunner } from "../ffmpeg";
import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";

type SlideDeck = {
  title?: string;
  slides?: Array<{ title?: string; bullets?: string[] }>;
};

export async function generateVideoOverview(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  ffmpeg?: FfmpegRunner;
  uploadFn?: (
    file: File | Blob,
    fileName?: string,
  ) => Promise<LensGroveUploadResult>;
}): Promise<{
  payload: { slideDeck: SlideDeck; mode: "narrated_slides" };
  mediaUrl: string;
  mediaMimeType: string;
}> {
  const deckResult = await generateTextRepurposeOutput({
    outputType: "slide_deck",
    source: input.source,
    fetchFn: input.fetchFn,
  });
  const slideDeck = deckResult.payload as SlideDeck;
  const titles =
    slideDeck.slides?.map((s, i) => s.title?.trim() || `Slide ${i + 1}`) ?? [];
  if (titles.length === 0) {
    throw new Error("Slide deck has no slides for video overview.");
  }

  const { mp3 } = await buildAudioOverviewMp3({
    source: input.source,
    fetchFn: input.fetchFn,
  });

  const workDir = mkdtempSync(join(tmpdir(), "dear-repurpose-video-"));
  const audioPath = join(workDir, "narration.mp3");
  writeFileSync(audioPath, mp3);

  const outputPath = join(workDir, "overview.mp4");
  const secondsPerSlide = Math.max(
    3,
    Math.min(8, Math.floor(120 / Math.max(titles.length, 1))),
  );

  await buildNarratedSlidesMp4({
    workDir,
    slideTitles: titles,
    secondsPerSlide,
    audioPath,
    outputPath,
    ffmpeg: input.ffmpeg,
  });

  const mp4 = await readFile(outputPath);
  const upload = input.uploadFn ?? uploadToLensGrove;
  const fileName = `${input.source.slug}-video-overview.mp4`;
  const uploaded = await upload(
    new File([new Uint8Array(mp4)], fileName, { type: "video/mp4" }),
    fileName,
  );

  return {
    payload: { slideDeck, mode: "narrated_slides" },
    mediaUrl: uploaded.gatewayUrl,
    mediaMimeType: "video/mp4",
  };
}
