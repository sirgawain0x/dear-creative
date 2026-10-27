export const PREVIEW_PAGE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";
export const PREVIEW_PAGE_X_ROBOTS_TAG = "noindex, nofollow";

export function applyPreviewPageHeaders(headers: Headers): void {
  headers.set("Cache-Control", PREVIEW_PAGE_CACHE_CONTROL);
  headers.set("X-Robots-Tag", PREVIEW_PAGE_X_ROBOTS_TAG);
}
