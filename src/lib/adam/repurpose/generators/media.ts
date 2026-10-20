import { synthesizeSpeechWithGoogle } from "@/lib/adam/gemini-studio";
import { uploadToLensGrove } from "@/lib/storage/lens-grove";
import type { FfmpegRunner } from "../ffmpeg";
import type { synthesizePodcastMultiSpeaker } from "../gemini-tts";
import type { RepurposePostSource } from "../post-source";
import type { RepurposeOutputType } from "../types";
import { repurposeMediaOutputTypes } from "../types";
import { generateAudioOverview } from "./audio-overview";
import { generateInfographic } from "./infographic";
import { generateVideoOverview } from "./video-overview";

export function isMediaRepurposeType(
  type: RepurposeOutputType,
): type is (typeof repurposeMediaOutputTypes)[number] {
  return (repurposeMediaOutputTypes as readonly string[]).includes(type);
}

export async function generateMediaRepurposeOutput(input: {
  outputType: (typeof repurposeMediaOutputTypes)[number];
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  synthesizeFn?: typeof synthesizeSpeechWithGoogle;
  synthesizeMultiSpeakerFn?: typeof synthesizePodcastMultiSpeaker;
  ffmpeg?: FfmpegRunner;
  uploadFn?: typeof uploadToLensGrove;
}): Promise<{
  payload: unknown;
  mediaUrl: string;
  mediaMimeType: string;
}> {
  switch (input.outputType) {
    case "audio_overview":
      return generateAudioOverview({
        source: input.source,
        fetchFn: input.fetchFn,
        synthesizeMultiSpeakerFn: input.synthesizeMultiSpeakerFn,
        uploadFn: input.uploadFn,
      });
    case "video_overview":
      return generateVideoOverview({
        source: input.source,
        fetchFn: input.fetchFn,
        synthesizeFn: input.synthesizeFn,
        ffmpeg: input.ffmpeg,
        uploadFn: input.uploadFn,
      });
    case "infographic":
      return generateInfographic({
        source: input.source,
        fetchFn: input.fetchFn,
        uploadFn: input.uploadFn,
      });
    default: {
      const _exhaustive: never = input.outputType;
      throw new Error(`Unsupported media type: ${_exhaustive}`);
    }
  }
}
