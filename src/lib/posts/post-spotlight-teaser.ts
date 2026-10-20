import { stripHtmlTags } from "./reading-time";

const MARKDOWN_IMAGE = /!\[[^\]]*]\([^)]*\)/g;
const MARKDOWN_LINK = /\[([^\]]*)]\([^)]*\)/g;
const MARKDOWN_HEADING = /^#{1,6}\s+/gm;
const MARKDOWN_FENCE = /```[\s\S]*?```/g;

export function stripMarkdown(raw: string): string {
  return raw
    .replace(MARKDOWN_FENCE, " ")
    .replace(MARKDOWN_IMAGE, " ")
    .replace(MARKDOWN_LINK, "$1")
    .replace(MARKDOWN_HEADING, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncatePlainTextTeaser(
  text: string,
  maxLen = 160,
): string | undefined {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= maxLen) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  const trimmed = cut.trim();
  return trimmed ? `${trimmed}…` : undefined;
}

export function buildPostSpotlightTeaser(post: {
  excerpt?: string;
  bodyHtml?: string | null;
}): string | undefined {
  const fromExcerpt = post.excerpt?.trim();
  if (fromExcerpt) {
    return fromExcerpt;
  }

  const source = post.bodyHtml?.trim();
  if (!source) {
    return undefined;
  }

  const plain = stripMarkdown(stripHtmlTags(source));
  return truncatePlainTextTeaser(plain, 160);
}
