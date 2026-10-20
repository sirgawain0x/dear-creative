import { generateDeterministicBannerDataUrl } from "@/lib/posts/post-cover-image";

export function spotlightCoverFallbackDataUrl(post: {
  slug: string;
  title: string;
}): string {
  return generateDeterministicBannerDataUrl({
    slug: post.slug,
    title: post.title,
  });
}

export function spotlightCoverDisplaySrc(options: {
  requestedSrc: string;
  loadFailed: boolean;
  fallbackSrc: string;
}): string {
  return options.loadFailed ? options.fallbackSrc : options.requestedSrc;
}
