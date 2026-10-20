import Image from "next/image";
import { shouldBypassImageOptimizer } from "@/lib/images/optimized-remote-image-allowlist";

type PostSpotlightCoverImageProps = {
  src: string;
  priority?: boolean;
};

export function PostSpotlightCoverImage({
  src,
  priority = false,
}: PostSpotlightCoverImageProps) {
  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      sizes="(max-width: 768px) 100vw, 320px"
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      unoptimized={shouldBypassImageOptimizer(src)}
    />
  );
}
