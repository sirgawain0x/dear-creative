import { stripMarkdown } from "./post-spotlight-teaser";
import { decodeHtmlEntities, stripHtmlTags } from "./reading-time";

export function buildPublicPostTeaser(input: {
  excerpt?: string | null;
  publicPreview?: string | null;
}): string | undefined {
  const excerpt = input.excerpt?.trim();
  if (excerpt) {
    return decodeHtmlEntities(excerpt);
  }

  const preview = input.publicPreview?.trim();
  if (!preview) {
    return undefined;
  }

  return decodeHtmlEntities(stripMarkdown(stripHtmlTags(preview)));
}
