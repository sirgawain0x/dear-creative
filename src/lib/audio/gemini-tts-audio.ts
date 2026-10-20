import { pcm16ToWavBuffer } from "@/lib/adam/gemini-studio";
import { encodePcmToMp3, parseWav } from "./narration";

export function parseSampleRateFromAudioMime(mimeType: string): number | null {
  const match = /rate=(\d+)/i.exec(mimeType);
  if (!match) {
    return null;
  }
  const rate = Number(match[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** True when the buffer looks like MP3 (ID3 tag or frame sync), not raw PCM. */
export function isLikelyMp3Buffer(buf: Buffer): boolean {
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return true;
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) {
    return true;
  }
  return false;
}

/**
 * Normalizes Gemini TTS bytes to MP3. Gemini often returns raw 24kHz s16le PCM
 * while advertising audio/mp3 or audio/L16;rate=24000.
 */
export function geminiTtsPayloadToMp3(buf: Buffer, mimeType: string): Buffer {
  if (isLikelyMp3Buffer(buf)) {
    return buf;
  }

  let wav = parseWav(buf);
  const sampleRate =
    parseSampleRateFromAudioMime(mimeType) ??
    (wav ? wav.sampleRate : 24000);

  if (!wav) {
    const wavBuffer = pcm16ToWavBuffer(buf.toString("base64"), sampleRate, 1);
    wav = parseWav(wavBuffer);
  }

  if (!wav) {
    throw new Error(`Unsupported TTS audio format: ${mimeType}`);
  }

  return encodePcmToMp3(wav.pcm, wav.sampleRate, wav.channels);
}
