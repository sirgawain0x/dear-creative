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
  probeAudioDurationSeconds,
  type FfmpegRunner,
} from "../ffmpeg";
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
      const slide = slides[i]!;
      const title = slide.title?.trim() || `Slide ${i + 1}`;
      const narration = narrationTextForSlide(slide);
      const mp3 = await synthesizeSlideNarrationMp3({
        text: narration,
        fetchFn: input.fetchFn,
        synthesizeFn: input.synthesizeFn,
      });
      const audioPath = join(workDir, `narration-${i}.mp3`);
      await writeFile(audioPath, mp3);
      const durationSeconds = await probeAudioDurationSeconds({
        audioPath,
        ffmpeg: input.ffmpeg,
      });
      slideSpecs.push({ title, audioPath, durationSeconds });
    }

    await buildNarratedSlidesMp4({
      workDir,
      slides: slideSpecs,
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
