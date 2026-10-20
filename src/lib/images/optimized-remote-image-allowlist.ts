import type { RemotePattern } from "next/dist/shared/lib/image-config";

/** Hostnames that may use the Next.js image optimizer (must stay in sync with cover resolver). */
export const OPTIMIZED_REMOTE_IMAGE_HOSTS = ["paragraph.xyz"] as const;

export type OptimizedRemoteImageHost =
  (typeof OPTIMIZED_REMOTE_IMAGE_HOSTS)[number];

export const GROVE_STORAGE_HOST = "api.grove.storage";

/** Remote patterns for `next.config` — exact hostnames only, no Grove. */
export const optimizedImageRemotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "paragraph.xyz",
    pathname: "/p/**",
  },
  {
    protocol: "https",
    hostname: "paragraph.xyz",
    pathname: "/@*/**",
  },
];

export function isGroveStorageHost(hostname: string): boolean {
  return hostname === GROVE_STORAGE_HOST;
}

export function isOptimizedRemoteImageHost(hostname: string): boolean {
  return (OPTIMIZED_REMOTE_IMAGE_HOSTS as readonly string[]).includes(
    hostname,
  );
}

export function isAllowlistedCoverImageUrl(url: string): boolean {
  if (url.startsWith("/") || url.startsWith("data:")) {
    return true;
  }
  try {
    const { hostname } = new URL(url);
    if (isGroveStorageHost(hostname)) {
      return true;
    }
    return isOptimizedRemoteImageHost(hostname);
  } catch {
    return false;
  }
}

export function shouldBypassImageOptimizer(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("/")) {
    return true;
  }
  try {
    return isGroveStorageHost(new URL(url).hostname);
  } catch {
    return true;
  }
}
