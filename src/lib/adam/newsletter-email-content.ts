import { ensureArticleHtml } from "@/lib/html/markdown-to-html";
import { buildPublicPostTeaser } from "@/lib/posts/post-public-teaser";
import { resolvePostPublicUrl } from "@/lib/posts/post-public-url";
import { stripMarkdown } from "@/lib/posts/post-spotlight-teaser";
import { stripHtmlTags } from "@/lib/posts/reading-time";
import { isPaywallEnabled } from "@/lib/paywall/feature-flag";
import { prependHiddenEmailPreheader } from "./newsletter-email-preheader";

export type NewsletterPaywallPostFields = {
  slug: string;
  canonicalUrl: string | null;
  isGated: boolean;
  freeContent: string | null;
  gatedContent: string | null;
};

export type BuildNewsletterEmailContentInput = NewsletterPaywallPostFields & {
  emailHtml: string;
};

export type NewsletterEmailContent = {
  html: string;
  text?: string;
};

const READ_THE_REST_LABEL = "Read the rest";

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function plainTextFromFreeContent(freeContent: string | null | undefined): string {
  const trimmed = freeContent?.trim();
  if (!trimmed) {
    return "";
  }
  const html = ensureArticleHtml(trimmed);
  return stripMarkdown(stripHtmlTags(html)).replace(/\s+/g, " ").trim();
}

export function buildNewsletterEmailContent(
  input: BuildNewsletterEmailContentInput,
): NewsletterEmailContent {
  if (!isPaywallEnabled() || !input.isGated) {
    return { html: input.emailHtml };
  }

  const postUrl = resolvePostPublicUrl({
    slug: input.slug,
    canonicalUrl: input.canonicalUrl,
  });
  const freeHtml = ensureArticleHtml(input.freeContent?.trim() || "");
  const readMoreHtml = `<p><a href="${escapeHtmlAttribute(postUrl)}">${READ_THE_REST_LABEL}</a></p>`;
  const bodyHtml = freeHtml ? `${freeHtml}\n${readMoreHtml}` : readMoreHtml;

  const freePlain = plainTextFromFreeContent(input.freeContent);
  const text = freePlain
    ? `${freePlain}\n\n${READ_THE_REST_LABEL}: ${postUrl}`
    : `${READ_THE_REST_LABEL}: ${postUrl}`;

  const inboxPreview = buildPublicPostTeaser({
    excerpt: null,
    publicPreview: input.freeContent,
  })?.trim();

  const html = prependHiddenEmailPreheader(bodyHtml, inboxPreview);

  return {
    html,
    text,
  };
}
