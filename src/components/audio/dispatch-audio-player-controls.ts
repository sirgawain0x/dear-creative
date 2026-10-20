/** Aria-labels for ±10s skip buttons (stored MP3 transport). */
export const LISTEN_SKIP_BACK_ARIA = "Seek back 10 seconds";
export const LISTEN_SKIP_FORWARD_ARIA = "Seek forward 10 seconds";

/**
 * Stored-audio transport order: −10s, play/pause (middle), +10s.
 * Middle slot uses play/pause/loading labels from the component.
 */
export function listenSeekTransportAriaOrder(): readonly [
  typeof LISTEN_SKIP_BACK_ARIA,
  "play/pause",
  typeof LISTEN_SKIP_FORWARD_ARIA,
] {
  return [LISTEN_SKIP_BACK_ARIA, "play/pause", LISTEN_SKIP_FORWARD_ARIA];
}
