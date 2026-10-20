"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  spotlightCoverDisplaySrc,
  spotlightCoverFallbackDataUrl,
} from "@/components/home/post-spotlight-cover-fallback";
import { shouldBypassImageOptimizer } from "@/lib/images/optimized-remote-image-allowlist";

type PostSpotlightCoverImageProps = {
  src: string;
  slug: string;
  title: string;
  priority?: boolean;
};

export function PostSpotlightCoverImage({
  src,
  slug,
  title,
  priority = false,
}: PostSpotlightCoverImageProps) {
  const fallbackSrc = useMemo(
    () => spotlightCoverFallbackDataUrl({ slug, title }),
    [slug, title],
  );
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loadFailed = failedSrc === src;

  const displaySrc = spotlightCoverDisplaySrc({
    requestedSrc: src,
    loadFailed,
    fallbackSrc,
  });

  return (
    <Image
      src={displaySrc}
      alt=""
      fill
      priority={priority}
      sizes="(max-width: 768px) 100vw, 320px"
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      unoptimized={shouldBypassImageOptimizer(displaySrc)}
      onError={() => setFailedSrc(src)}
    />
  );
}
