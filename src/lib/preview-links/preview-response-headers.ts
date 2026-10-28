import type { NextResponse } from "next/server";

export const PREVIEW_PAGE_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate";
export const PREVIEW_PAGE_X_ROBOTS_TAG = "noindex, nofollow";
export const PREVIEW_PAGE_REFERRER_POLICY = "no-referrer";

export function applyPreviewPageHeaders(headers: Headers): void {
  headers.set("Cache-Control", PREVIEW_PAGE_CACHE_CONTROL);
  headers.set("X-Robots-Tag", PREVIEW_PAGE_X_ROBOTS_TAG);
  headers.set("Referrer-Policy", PREVIEW_PAGE_REFERRER_POLICY);
}

/** Applied in proxy for all /preview/* responses (tokens live in the URL path). */
export function applyPreviewRouteResponseHeaders(
  response: NextResponse,
): NextResponse {
  applyPreviewPageHeaders(response.headers);
  return response;
}
