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
