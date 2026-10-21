import { isPaywallEnabled } from "./feature-flag";

/** Reader-facing API route that enforces paywall before returning stored narration. */
export function readerGatedPostAudioApiPath(slug: string): string {
  return `/api/posts/${encodeURIComponent(slug)}/audio`;
}

export function resolveReaderFacingAudioUrl(input: {
  slug: string;
  isGated: boolean;
  storedAudioUrl: string | null | undefined;
}): string | null {
  const stored = input.storedAudioUrl?.trim();
  if (!stored) {
    return null;
  }
  if (!isPaywallEnabled() || !input.isGated) {
    return stored;
  }
  return readerGatedPostAudioApiPath(input.slug);
}
