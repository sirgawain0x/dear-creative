/** Beehiiv CDN URLs that permanently fail; strip from HTML instead of blocking the post. */
export const KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS = [
  "landscape_Story_telling__1280_x_720_px_.jpg",
] as const;

export function isKnownDroppedBeehiivImageUrl(url: string): boolean {
  return KNOWN_DROPPED_BEEHIIV_IMAGE_MARKERS.some((marker) =>
    url.includes(marker),
  );
}
