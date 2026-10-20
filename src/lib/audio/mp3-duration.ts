/**
 * Estimates MP3 duration from the encoded PCM length when the MP3 was produced
 * from a single contiguous PCM buffer (mono 16-bit), matching encodePcmToMp3.
 */
export function estimateMp3DurationSecFromSourcePcm(
  pcmByteLength: number,
  sampleRate: number,
  channels = 1,
): number {
  const sampleBytes = 2 * channels;
  const samples = pcmByteLength / sampleBytes;
  return samples / sampleRate;
}

/**
 * Parses a minimal MP3 buffer (CBR from lamejs) via frame sync and bitrate in
 * the first valid frame header, for regression tests on merged article output.
 */
export function parseMp3DurationSec(mp3: Buffer): number | null {
  if (mp3.length < 4 || mp3[0] !== 0xff || (mp3[1]! & 0xe0) !== 0xe0) {
    return null;
  }
  const versionIndex = (mp3[1]! >> 3) & 0x03;
  const layerIndex = (mp3[1]! >> 1) & 0x03;
  const bitrateIndex = (mp3[2]! >> 4) & 0x0f;
  const sampleRateIndex = (mp3[2]! >> 2) & 0x03;

  if (layerIndex === 0 || bitrateIndex === 0 || bitrateIndex === 0x0f) {
    return null;
  }

  const bitratesKbps = [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  ];
  const sampleRates = [
    [44100, 48000, 32000],
    [22050, 24000, 16000],
    [11025, 12000, 8000],
  ];

  const versionRow = versionIndex === 3 ? 2 : versionIndex === 2 ? 0 : 1;
  const bitrateKbps = bitratesKbps[versionRow]?.[bitrateIndex];
  const sampleRate = sampleRates[versionRow]?.[sampleRateIndex];
  if (!bitrateKbps || !sampleRate) {
    return null;
  }

  const audioBytes = mp3.length;
  return (audioBytes * 8) / (bitrateKbps * 1000);
}

/** Validates merged narration MP3 duration against source PCM (test helper). */
export function narrationMp3DurationMatchesPcm(
  mp3: Buffer,
  pcm: Buffer,
  sampleRate: number,
  channels = 1,
  toleranceSec = 0.75,
): boolean {
  const expected = estimateMp3DurationSecFromSourcePcm(
    pcm.length,
    sampleRate,
    channels,
  );
  const parsed = parseMp3DurationSec(mp3);
  if (parsed === null) {
    return false;
  }
  return Math.abs(parsed - expected) <= toleranceSec;
}
