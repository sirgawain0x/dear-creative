import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { synthesizeSpeechWithGoogle } from "@/lib/adam/gemini-studio";
import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";
import {
  buildNarratedSlidesMp4,
  createDeadlineAwareFfmpegRunner,
  probeAudioDurationSeconds,
  type FfmpegRunner,
} from "../ffmpeg";
import {
  assertRepurposePipelineBudget,
  createRepurposeVideoPipelineDeadline,
  REPURPOSE_VIDEO_DECK_PER_FETCH_CAP_MS,
  REPURPOSE_VIDEO_TTS_PER_FETCH_CAP_MS,
  REPURPOSE_VIDEO_UPLOAD_PER_CALL_CAP_MS,
  uploadWithRepurposePipelineDeadline,
  wrapFetchForRepurposePipeline,
} from "../pipeline-deadline";
import type { RepurposePostSource } from "../post-source";
import { validateRepurposeModelOutput } from "../validate-output";
import { generateTextRepurposeOutput } from "./text";
import { synthesizeSlideNarrationMp3 } from "./audio-overview";

type SlideDeck = {
  title?: string;
  slides?: Array<{
    title?: string;
    bullets?: string[];
    speakerNotes?: string;
  }>;
};

export type RepurposeVideoPipelineOptions = {
  deadlineAtMs?: number;
  nowFn?: () => number;
  deckPerFetchCapMs?: number;
  ttsPerFetchCapMs?: number;
  uploadPerCallCapMs?: number;
};

function narrationTextForSlide(slide: NonNullable<SlideDeck["slides"]>[number]): string {
  const notes = slide.speakerNotes?.trim();
  if (notes) return notes;
  const bullets = (slide.bullets ?? []).map((b) => b.trim()).filter(Boolean);
  if (bullets.length > 0) return bullets.join(". ");
  return slide.title?.trim() || "Slide";
}

export async function generateVideoOverview(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  synthesizeFn?: typeof synthesizeSpeechWithGoogle;
  ffmpeg?: FfmpegRunner;
  uploadFn?: (
    file: File | Blob,
    fileName?: string,
    signal?: AbortSignal,
  ) => Promise<LensGroveUploadResult>;
  pipeline?: RepurposeVideoPipelineOptions;
}): Promise<{
  payload: { slideDeck: SlideDeck; mode: "narrated_slides" };
  mediaUrl: string;
  mediaMimeType: string;
}> {
  const nowFn = input.pipeline?.nowFn ?? Date.now;
  const deadlineAtMs =
    input.pipeline?.deadlineAtMs ?? createRepurposeVideoPipelineDeadline(nowFn());
  const deckPerFetchCapMs =
    input.pipeline?.deckPerFetchCapMs ?? REPURPOSE_VIDEO_DECK_PER_FETCH_CAP_MS;
  const ttsPerFetchCapMs =
    input.pipeline?.ttsPerFetchCapMs ?? REPURPOSE_VIDEO_TTS_PER_FETCH_CAP_MS;
  const uploadPerCallCapMs =
    input.pipeline?.uploadPerCallCapMs ?? REPURPOSE_VIDEO_UPLOAD_PER_CALL_CAP_MS;

  const baseFetch = input.fetchFn ?? fetch;
  const deckFetch = wrapFetchForRepurposePipeline(
    baseFetch,
    deadlineAtMs,
    deckPerFetchCapMs,
    nowFn,
  );
  const ttsFetch = wrapFetchForRepurposePipeline(
    baseFetch,
    deadlineAtMs,
    ttsPerFetchCapMs,
    nowFn,
  );
  const ffmpeg =
    input.ffmpeg ??
    createDeadlineAwareFfmpegRunner({
      deadlineAtMs,
      nowFn,
    });

  assertRepurposePipelineBudget(deadlineAtMs, nowFn());

  const deckResult = await generateTextRepurposeOutput({
    outputType: "slide_deck",
    source: input.source,
    fetchFn: deckFetch,
  });
  const slideDeck = validateRepurposeModelOutput(
    "slide_deck",
    deckResult.payload,
  ) as SlideDeck;

  const slides = slideDeck.slides ?? [];
  if (slides.length === 0) {
    throw new Error("Slide deck has no slides for video overview.");
  }

  const workDir = await mkdtemp(join(tmpdir(), "dear-repurpose-video-"));
  const outputPath = join(workDir, "overview.mp4");

  try {
    const slideSpecs: Array<{
      title: string;
      audioPath: string;
      durationSeconds: number;
    }> = [];

    for (let i = 0; i < slides.length; i++) {
      assertRepurposePipelineBudget(deadlineAtMs, nowFn());
      const slide = slides[i]!;
      const title = slide.title?.trim() || `Slide ${i + 1}`;
      const narration = narrationTextForSlide(slide);
      const mp3 = await synthesizeSlideNarrationMp3({
        text: narration,
        fetchFn: ttsFetch,
        synthesizeFn: input.synthesizeFn,
      });
      const audioPath = join(workDir, `narration-${i}.mp3`);
      await writeFile(audioPath, mp3);
      const durationSeconds = await probeAudioDurationSeconds({
        audioPath,
        ffmpeg,
      });
      slideSpecs.push({ title, audioPath, durationSeconds });
    }

    assertRepurposePipelineBudget(deadlineAtMs, nowFn());

    await buildNarratedSlidesMp4({
      workDir,
      slides: slideSpecs,
      outputPath,
      ffmpeg,
    });

    assertRepurposePipelineBudget(deadlineAtMs, nowFn());

    const mp4 = await readFile(outputPath);
    const upload = input.uploadFn ?? uploadToLensGrove;
    const fileName = `${input.source.slug}-video-overview.mp4`;
    const uploaded = await uploadWithRepurposePipelineDeadline(
      upload,
      new File([new Uint8Array(mp4)], fileName, { type: "video/mp4" }),
      fileName,
      deadlineAtMs,
      uploadPerCallCapMs,
      nowFn(),
      nowFn,
    );

    const payload = validateRepurposeModelOutput("video_overview", {
      slideDeck,
      mode: "narrated_slides",
    }) as { slideDeck: SlideDeck; mode: "narrated_slides" };

    return {
      payload,
      mediaUrl: uploaded.gatewayUrl,
      mediaMimeType: "video/mp4",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
