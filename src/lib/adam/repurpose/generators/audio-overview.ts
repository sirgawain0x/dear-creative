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
import type { RepurposePostSource } from "../post-source";

export type PodcastScript = {
  title?: string;
  intro?: string;
  segments?: Array<{ speaker?: string; text?: string }>;
  outro?: string;
};

const HOST_VOICES: Record<string, string> = {
  host_a: "Puck",
  host_b: "Aoede",
};

export async function buildAudioOverviewMp3(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  synthesizeFn?: typeof synthesizeSpeechWithGoogle;
}): Promise<{ script: PodcastScript; mp3: Buffer }> {
  const script = (await generateRepurposeStructuredJson({
    outputType: "audio_overview",
    source: {
      title: input.source.title,
      plainText: input.source.plainText,
    },
    fetchFn: input.fetchFn,
  })) as PodcastScript;

  const lines: Array<{ voice: string; text: string }> = [];
  if (script.intro?.trim()) {
    lines.push({ voice: HOST_VOICES.host_a!, text: script.intro.trim() });
  }
  for (const segment of script.segments ?? []) {
    const text = segment.text?.trim();
    if (!text) continue;
    const speaker = segment.speaker === "host_b" ? "host_b" : "host_a";
    lines.push({ voice: HOST_VOICES[speaker]!, text });
  }
  if (script.outro?.trim()) {
    lines.push({ voice: HOST_VOICES.host_b!, text: script.outro.trim() });
  }
  if (lines.length === 0) {
    throw new Error("Audio overview script has no speakable segments.");
  }

  const synth = input.synthesizeFn ?? synthesizeSpeechWithGoogle;
  const pcmParts: Buffer[] = [];
  const mp3Parts: Buffer[] = [];
  let sampleRate = 24000;
  let channels = 1;

  for (const line of lines) {
    const speech = await synth({
      text: line.text,
      voiceName: line.voice,
      fetchFn: input.fetchFn,
    });
    const buf = Buffer.from(speech.audioBase64, "base64");
    if (speech.mimeType.includes("mp3") || speech.mimeType.includes("mpeg")) {
      mp3Parts.push(buf);
      continue;
    }
    let wav = parseWav(buf);
    if (!wav && speech.mimeType.includes("L16")) {
      wav = parseWav(pcm16ToWavBuffer(speech.audioBase64, sampleRate));
    }
    if (!wav) {
      throw new Error(`Unsupported TTS audio format: ${speech.mimeType}`);
    }
    sampleRate = wav.sampleRate;
    channels = wav.channels;
    pcmParts.push(wav.pcm);
  }

  if (pcmParts.length > 0 && mp3Parts.length > 0) {
    throw new Error("Mixed TTS formats in audio overview.");
  }

  const mp3 =
    pcmParts.length > 0
      ? encodePcmToMp3(Buffer.concat(pcmParts), sampleRate, channels)
      : Buffer.concat(mp3Parts);

  return { script, mp3 };
}

export async function generateAudioOverview(input: {
  source: RepurposePostSource;
  fetchFn?: typeof fetch;
  synthesizeFn?: typeof synthesizeSpeechWithGoogle;
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
