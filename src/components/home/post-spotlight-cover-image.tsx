import Image from "next/image";

type PostSpotlightCoverImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
};

function isUnoptimizedImageSrc(src: string): boolean {
  return src.startsWith("data:") || src.startsWith("/");
}

export function PostSpotlightCoverImage({
  src,
  alt,
  priority = false,
}: PostSpotlightCoverImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(max-width: 768px) 100vw, 320px"
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      unoptimized={isUnoptimizedImageSrc(src)}
    />
  );
}
