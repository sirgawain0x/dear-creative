/** Label shown to readers for stored narration (hide internal voice ids). */
export function readerStoredNarrationLabel(
  audioVoice: string | null | undefined,
): string {
  const voice = audioVoice?.trim();
  if (!voice) return "Kokoro";
  if (voice.startsWith("af_")) return "Kokoro";
  return voice;
}
