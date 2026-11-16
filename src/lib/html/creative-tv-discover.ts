export const CREATIVE_TV_DISCOVER =
  /^https?:\/\/tv\.creativeplatform\.xyz\/(?:embed\/)?discover\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?(?:[?#][^\s]*)?$/i;

/** Creative TV currently blocks framing both its Discover and Discover embed pages. */
export function linkCreativeTvDiscoverEmbeds(html: string): string {
  return html.replace(
    /<iframe\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/iframe>/gi,
    (iframe, src: string) => {
      const id = CREATIVE_TV_DISCOVER.exec(src)?.[1];
      return id
        ? `<a class="dear-btn dear-video-fallback" href="https://tv.creativeplatform.xyz/discover/${id}" target="_blank" rel="noopener noreferrer nofollow">Watch on Creative TV ↗</a>`
        : iframe;
    },
  );
}
