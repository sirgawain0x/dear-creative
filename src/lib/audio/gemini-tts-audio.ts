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

const UNSUPPORTED_TTS_FORMAT = "Unsupported TTS audio format";

function assertNotOggOrFlac(buf: Buffer): void {
  if (buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "OggS") {
    throw new Error(UNSUPPORTED_TTS_FORMAT);
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "fLaC") {
    throw new Error(UNSUPPORTED_TTS_FORMAT);
  }
}

function skipId3Tag(buf: Buffer): number {
  if (buf.length < 10) {
    return 0;
  }
  if (buf.subarray(0, 3).toString("ascii") !== "ID3") {
    return 0;
  }
  const size =
    ((buf[6]! & 0x7f) << 21) |
    ((buf[7]! & 0x7f) << 14) |
    ((buf[8]! & 0x7f) << 7) |
    (buf[9]! & 0x7f);
  return 10 + size;
}

const MPEG1_L3_BITRATE_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const MPEG2_L3_BITRATE_KBPS = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];

function mp3FrameLengthAt(buf: Buffer, offset: number): number | null {
  if (offset + 4 > buf.length) {
    return null;
  }
  if (buf[offset] !== 0xff || (buf[offset + 1]! & 0xe0) !== 0xe0) {
    return null;
  }

  const b1 = buf[offset + 1]!;
  const b2 = buf[offset + 2]!;

  const versionBits = (b1 >> 3) & 0x03;
  if (versionBits === 0x01) {
    return null;
  }
  const layerBits = (b1 >> 1) & 0x03;
  if (layerBits === 0x00) {
    return null;
  }
  if (layerBits !== 0x01) {
    return null;
  }

  const bitrateIndex = (b2 >> 4) & 0x0f;
  if (bitrateIndex === 0x0f || bitrateIndex === 0x00) {
    return null;
  }

  const sampleRateIndex = (b2 >> 2) & 0x03;
  if (sampleRateIndex === 0x03) {
    return null;
  }

  const padding = (b2 >> 1) & 0x01;

  let bitrateKbps: number;
  let sampleRate: number;
  if (versionBits === 0x03) {
    bitrateKbps = MPEG1_L3_BITRATE_KBPS[bitrateIndex]!;
    sampleRate = [44100, 48000, 32000, 0][sampleRateIndex]!;
  } else if (versionBits === 0x02) {
    bitrateKbps = MPEG2_L3_BITRATE_KBPS[bitrateIndex]!;
    sampleRate = [22050, 24000, 16000, 0][sampleRateIndex]!;
  } else {
    bitrateKbps = MPEG2_L3_BITRATE_KBPS[bitrateIndex]!;
    sampleRate = [11025, 12000, 8000, 0][sampleRateIndex]!;
  }

  if (!bitrateKbps || !sampleRate) {
    return null;
  }

  const scale = versionBits === 0x03 ? 144 : 72;
  return Math.floor((scale * bitrateKbps * 1000) / sampleRate) + padding;
}

function hasValidMp3FrameSync(buf: Buffer, offset: number): boolean {
  const frameLen = mp3FrameLengthAt(buf, offset);
  if (frameLen === null || frameLen < 4) {
    return false;
  }
  const next = offset + frameLen;
  if (next + 2 > buf.length) {
    return buf.length - offset >= 4;
  }
  return buf[next] === 0xff && (buf[next + 1]! & 0xe0) === 0xe0;
}

/** True when the buffer contains a validated MP3 (ID3 + frames or frame sync chain). */
export function isLikelyMp3Buffer(buf: Buffer): boolean {
  if (buf.length < 4) {
    return false;
  }
  if (buf.subarray(0, 3).toString("ascii") === "ID3") {
    const audioStart = skipId3Tag(buf);
    return hasValidMp3FrameSync(buf, audioStart);
  }
  if (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) {
    return hasValidMp3FrameSync(buf, 0);
  }
  return false;
}

/**
 * Normalizes Gemini TTS bytes to MP3. Gemini often returns raw 24kHz s16le PCM
 * while advertising audio/mp3 or audio/L16;rate=24000.
 */
export function geminiTtsPayloadToMp3(buf: Buffer, mimeType: string): Buffer {
  assertNotOggOrFlac(buf);

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
    throw new Error(`${UNSUPPORTED_TTS_FORMAT}: ${mimeType}`);
  }

  return encodePcmToMp3(wav.pcm, wav.sampleRate, wav.channels);
}
