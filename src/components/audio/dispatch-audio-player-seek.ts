/** Seconds moved per ArrowLeft / ArrowRight on the progress slider. */
export const SEEK_KEYBOARD_STEP_SEC = 5;

export const SEEK_SKIP_SECONDS = 10;

export function clampSeekTime(
  currentTime: number,
  deltaSeconds: number,
  duration: number,
): number {
  const max = Math.max(0, duration);
  if (max === 0) return 0;
  return Math.min(max, Math.max(0, currentTime + deltaSeconds));
}

export function seekRatioFromClientX(
  clientX: number,
  rect: { left: number; width: number },
): number {
  if (rect.width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

export function seekTimeFromClientX(
  clientX: number,
  rect: { left: number; width: number },
  duration: number,
): number {
  if (duration <= 0) return 0;
  return seekRatioFromClientX(clientX, rect) * duration;
}

export type SeekKeyboardKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End";

export function keyboardSeekTime(
  currentTime: number,
  duration: number,
  key: SeekKeyboardKey,
): number | null {
  if (duration <= 0) return null;
  switch (key) {
    case "ArrowLeft":
      return clampSeekTime(currentTime, -SEEK_KEYBOARD_STEP_SEC, duration);
    case "ArrowRight":
      return clampSeekTime(currentTime, SEEK_KEYBOARD_STEP_SEC, duration);
    case "Home":
      return 0;
    case "End":
      return duration;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/** Scrubber and ±skip controls only apply to seekable stored MP3 playback. */
export function shouldShowStoredAudioSeekControls(options: {
  useBrowserSpeech: boolean;
  hasStaticAudioSrc: boolean;
}): boolean {
  return options.hasStaticAudioSrc && !options.useBrowserSpeech;
}
