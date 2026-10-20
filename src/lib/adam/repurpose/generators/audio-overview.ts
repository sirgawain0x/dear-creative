import {
  encodePcmToMp3,
  parseWav,
} from "@/lib/audio/narration";
import {
  pcm16ToWavBuffer,
  synthesizeSpeechWithGoogle,
} from "@/lib/adam/gemini-studio";
import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";
import { generateRepurposeStructuredJson } from "../gemini-json";
import {
  synthesizePodcastMultiSpeaker,
  type PodcastSegment,
} from "../gemini-tts";
import type { RepurposePostSource } from "../post-source";
import { validateRepurposeModelOutput } from "../validate-output";

export type PodcastScript = {
  title?: string;
  intro?: string;
  segments?: Array<{ speaker?: string; text?: string }>;
  outro?: string;
};

function scriptToPodcastSegments(script: PodcastScript): PodcastSegment[] {
  const segments: PodcastSegment[] = [];
  if (script.intro?.trim()) {
    segments.push({ speaker: "host_a", text: script.intro.trim() });
  }
  for (const segment of script.segments ?? []) {
    const text = segment.text?.trim();
    if (!text) continue;
    segments.push({
      speaker: segment.speaker === "host_b" ? "host_b" : "host_a",
      text,
    });
  }
  if (script.outro?.trim()) {
    segments.push({ speaker: "host_b", text: script.outro.trim() });
  }
  return segments;
}

async function multiSpeakerSpeechToMp3(input: {
  segments: PodcastSegment[];
  fetchFn?: typeof fetch;
  synthesizeMultiSpeakerFn?: typeof synthesizePodcastMultiSpeaker;
}): Promise<Buffer> {
  const synth = input.synthesizeMultiSpeakerFn ?? synthesizePodcastMultiSpeaker;
  const speech = await synth({
    segments: input.segments,
    fetchFn: input.fetchFn,
  });
  const buf = Buffer.from(speech.audioBase64, "base64");
  if (speech.mimeType.includes("mp3") || speech.mimeType.includes("mpeg")) {
    return buf;
  }
  let wav = parseWav(buf);
  if (!wav && speech.mimeType.includes("L16")) {
    wav = parseWav(pcm16ToWavBuffer(speech.audioBase64, 24000));
  }
  if (!wav) {
    throw new Error(`Unsupported TTS audio format: ${speech.mimeType}`);
  }
  return encodePcmToMp3(wav.pcm, wav.sampleRate, wav.channels);
}

export async function buildAudioOverviewMp3(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  synthesizeMultiSpeakerFn?: typeof synthesizePodcastMultiSpeaker;
}): Promise<{ script: PodcastScript; mp3: Buffer }> {
  const rawScript = (await generateRepurposeStructuredJson({
    outputType: "audio_overview",
    source: {
      title: input.source.title,
      plainText: input.source.plainText,
    },
    fetchFn: input.fetchFn,
  })) as PodcastScript;

  const script = validateRepurposeModelOutput(
    "audio_overview",
    rawScript,
  ) as PodcastScript;

  const segments = scriptToPodcastSegments(script);
  if (segments.length === 0) {
    throw new Error("Audio overview script has no speakable segments.");
  }

  const mp3 = await multiSpeakerSpeechToMp3({
    segments,
    fetchFn: input.fetchFn,
    synthesizeMultiSpeakerFn: input.synthesizeMultiSpeakerFn,
  });

  return { script, mp3 };
}

export async function generateAudioOverview(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  synthesizeMultiSpeakerFn?: typeof synthesizePodcastMultiSpeaker;
  uploadFn?: (
    file: File | Blob,
    fileName?: string,
  ) => Promise<LensGroveUploadResult>;
}): Promise<{
  payload: PodcastScript;
  mediaUrl: string;
  mediaMimeType: string;
}> {
  const { script, mp3 } = await buildAudioOverviewMp3(input);
  const upload = input.uploadFn ?? uploadToLensGrove;
  const fileName = `${input.source.slug}-audio-overview.mp3`;
  const uploaded = await upload(
    new File([new Uint8Array(mp3)], fileName, { type: "audio/mpeg" }),
    fileName,
  );

  return {
    payload: script,
    mediaUrl: uploaded.gatewayUrl,
    mediaMimeType: "audio/mpeg",
  };
}

/** @internal Per-slide narration for video overview (inject synthesizeFn in tests). */
export async function synthesizeSlideNarrationMp3(input: {
  text: string;
  fetchFn?: typeof fetch;
  synthesizeFn?: typeof synthesizeSpeechWithGoogle;
}): Promise<Buffer> {
  const synth = input.synthesizeFn ?? synthesizeSpeechWithGoogle;
  const speech = await synth({
    text: input.text,
    voiceName: "Puck",
    fetchFn: input.fetchFn,
  });
  const buf = Buffer.from(speech.audioBase64, "base64");
  if (speech.mimeType.includes("mp3") || speech.mimeType.includes("mpeg")) {
    return buf;
  }
  let wav = parseWav(buf);
  if (!wav && speech.mimeType.includes("L16")) {
    wav = parseWav(pcm16ToWavBuffer(speech.audioBase64, 24000));
  }
  if (!wav) {
    throw new Error(`Unsupported TTS audio format: ${speech.mimeType}`);
  }
  return encodePcmToMp3(wav.pcm, wav.sampleRate, wav.channels);
}
