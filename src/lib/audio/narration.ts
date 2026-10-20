import { Mp3Encoder } from "@breezystack/lamejs";
import { stripHtmlTags } from "@/lib/posts/reading-time";
import {
  uploadToLensGrove,
  type LensGroveUploadResult,
} from "@/lib/storage/lens-grove";
import { NARRATION_CHUNK_MAX_CHARS } from "./narration-chunk-limits";
import {
  createNarrationDeadline,
  rethrowNarrationFetchError,
  throwIfNarrationDeadlineExceeded,
} from "./narration-deadline";
import { synthesizeNarrationChunks } from "./narration-synthesize";

export {
  isNarrationVoice,
  NARRATION_VOICES,
  voiceLabel,
  type NarrationVoice,
} from "./narration-voices";

export { NARRATION_CHUNK_MAX_CHARS };

/** Builds the narration script spoken for a post: title, teaser, then body. */
export function buildNarrationScript(input: {
  title: string;
  teaserText?: string | null;
  bodyHtml?: string | null;
}): string {
  const body = stripHtmlTags(input.bodyHtml ?? "").replace(/\s+/g, " ").trim();
  const teaser = input.teaserText?.trim();
  return [input.title.trim(), teaser, body]
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part!) ? part : `${part}.`))
    .join(" ")
    .trim();
}

/**
 * Splits text into TTS-sized chunks on sentence boundaries so long articles
 * are narrated in full (the TTS call truncates around 10k characters).
 */
export function chunkNarrationText(
  text: string,
  maxChars = NARRATION_CHUNK_MAX_CHARS,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars));
      }
      continue;
    }
    if (current && current.length + 1 + sentence.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

type PcmInfo = { pcm: Buffer; sampleRate: number; channels: number };

/** Extracts 16-bit PCM samples and format from a RIFF/WAVE buffer. */
export function parseWav(buf: Buffer): PcmInfo | null {
  if (
    buf.length < 44 ||
    buf.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buf.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    return null;
  }
  let offset = 12;
  let sampleRate = 24000;
  let channels = 1;
  while (offset + 8 <= buf.length) {
    const id = buf.subarray(offset, offset + 4).toString("ascii");
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
    } else if (id === "data") {
      const end = Math.min(body + size, buf.length);
      return { pcm: buf.subarray(body, end), sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/**
 * Encodes mono/stereo 16-bit PCM into one MP3 buffer (@breezystack/lamejs).
 * Pure JS — no ffmpeg binary — safe on Vercel serverless without extra bundles.
 */
export function encodePcmToMp3(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  kbps = 64,
): Buffer {
  const samples = new Int16Array(
    pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + (pcm.length - (pcm.length % 2))),
  );
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const blockSize = 1152;
  const out: Uint8Array[] = [];

  if (channels === 2) {
    const frames = Math.floor(samples.length / 2);
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = samples[i * 2]!;
      right[i] = samples[i * 2 + 1]!;
    }
    for (let i = 0; i < frames; i += blockSize) {
      const chunk = encoder.encodeBuffer(
        left.subarray(i, i + blockSize),
        right.subarray(i, i + blockSize),
      );
      if (chunk.length) out.push(chunk);
    }
  } else {
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = encoder.encodeBuffer(samples.subarray(i, i + blockSize));
      if (chunk.length) out.push(chunk);
    }
  }
  const tail = encoder.flush();
  if (tail.length) out.push(tail);
  return Buffer.concat(out.map((c) => Buffer.from(c)));
}

export type NarrationResult = {
  url: string;
  uri: string;
  storageKey: string;
  voice: string;
  mimeType: "audio/mpeg";
  bytes: number;
  chunks: number;
  provider: string;
};

export type GeneratePostNarrationMp3Options = {
  slug: string;
  title: string;
  teaserText?: string | null;
  bodyHtml?: string | null;
  voice: string;
  fetchFn?: typeof fetch;
  synthesizeChunksFn?: typeof synthesizeNarrationChunks;
  uploadFn?: (file: File | Blob, fileName?: string) => Promise<LensGroveUploadResult>;
  deadlineAtMs?: number;
};

/**
 * Synthesizes the full narration once (chunked), merges PCM into a single MP3,
 * and uploads it to Lens Grove.
 */
export async function generatePostNarrationMp3(
  input: GeneratePostNarrationMp3Options,
): Promise<NarrationResult> {
  const script = buildNarrationScript(input);
  const chunks = chunkNarrationText(script);
  if (chunks.length === 0) {
    throw new Error("Post has no text to narrate.");
  }

  const deadlineAtMs = input.deadlineAtMs ?? createNarrationDeadline();
  const synth = input.synthesizeChunksFn ?? synthesizeNarrationChunks;
  const upload = input.uploadFn ?? uploadToLensGrove;

  throwIfNarrationDeadlineExceeded(deadlineAtMs);

  let synthesized;
  try {
    synthesized = await synth({
      chunks,
      voiceName: input.voice,
      fetchFn: input.fetchFn,
      deadlineAtMs,
    });
  } catch (err) {
    rethrowNarrationFetchError(err);
  }

  const pcmParts: Buffer[] = [];
  const mp3Parts: Buffer[] = [];
  let sampleRate = 24000;
  let channels = 1;

  for (const speech of synthesized.parts) {
    throwIfNarrationDeadlineExceeded(deadlineAtMs);
    const buf = Buffer.from(speech.audioBase64, "base64");
    if (speech.mimeType.includes("mp3") || speech.mimeType.includes("mpeg")) {
      mp3Parts.push(buf);
      continue;
    }
    const wav = parseWav(buf);
    if (!wav) {
      throw new Error(`Unsupported TTS audio format: ${speech.mimeType}`);
    }
    sampleRate = wav.sampleRate;
    channels = wav.channels;
    pcmParts.push(wav.pcm);
  }

  if (pcmParts.length > 0 && mp3Parts.length > 0) {
    throw new Error(
      "TTS provider switched formats mid-article; please retry narration generation.",
    );
  }

  const mergedPcm =
    pcmParts.length > 0 ? Buffer.concat(pcmParts) : Buffer.alloc(0);
  const mp3 =
    pcmParts.length > 0
      ? encodePcmToMp3(mergedPcm, sampleRate, channels)
      : Buffer.concat(mp3Parts);

  const fileName = `${input.slug}-${input.voice.toLowerCase()}-narration.mp3`;
  const uploaded = await upload(
    new File([new Uint8Array(mp3)], fileName, { type: "audio/mpeg" }),
    fileName,
  );

  return {
    url: uploaded.gatewayUrl,
    uri: uploaded.uri,
    storageKey: uploaded.storageKey,
    voice: input.voice,
    mimeType: "audio/mpeg",
    bytes: mp3.length,
    chunks: chunks.length,
    provider: synthesized.provider,
  };
}
