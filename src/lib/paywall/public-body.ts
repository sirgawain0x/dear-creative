import { ensureArticleHtml } from "@/lib/html/markdown-to-html";
import { isPaywallEnabled } from "./feature-flag";

export type PostBodySource = {
  isGated: boolean;
  bodyHtml: string | null;
  freeContent: string | null;
  gatedContent: string | null;
};

/** HTML safe to expose to crawlers, RSS, lists, and unpaid readers. */
export function resolvePublicReaderBodyHtml(
  post: PostBodySource,
): string | null {
  if (!isPaywallEnabled() || !post.isGated) {
    return post.bodyHtml;
  }
  const free = post.freeContent?.trim();
  if (!free) {
    return null;
  }
  return ensureArticleHtml(free);
}

/** Full article HTML for entitled readers when paywall is active. */
export function resolveFullReaderBodyHtml(post: PostBodySource): string | null {
  if (!isPaywallEnabled() || !post.isGated) {
    return post.bodyHtml;
  }
  const fullFromColumns = combineFreeAndGatedHtml(post);
  if (fullFromColumns) {
    return fullFromColumns;
  }
  return post.bodyHtml;
}

function combineFreeAndGatedHtml(post: PostBodySource): string | null {
  const free = post.freeContent?.trim();
  const gated = post.gatedContent?.trim();
  if (!free && !gated) {
    return post.bodyHtml;
  }
  const parts: string[] = [];
  if (free) {
    parts.push(ensureArticleHtml(free));
  }
  if (gated) {
    parts.push(ensureArticleHtml(gated));
  }
  const combined = parts.join("\n").trim();
  return combined || null;
}

/** Body HTML used for list cards, RSS, OG, and sitemap (never gated sections). */
export function bodyHtmlForPublicSurfaces(
  post: PostBodySource,
): string | null | undefined {
  if (!isPaywallEnabled() || !post.isGated) {
    return post.bodyHtml;
  }
  return resolvePublicReaderBodyHtml(post);
}
