import { ensureArticleHtml } from "@/lib/html/markdown-to-html";
import { preparePostBodyHtmlForRender } from "@/lib/posts/body-html-for-render";
import type { AdminPostRecord } from "@/lib/posts/manage-posts";

function previewFullBodyHtml(post: AdminPostRecord): string | null {
  if (!post.isGated) {
    return post.bodyHtml;
  }
  const parts: string[] = [];
  const free = post.freeContent?.trim();
  const gated = post.gatedContent?.trim();
  if (free) {
    parts.push(ensureArticleHtml(free));
  }
  if (gated) {
    parts.push(ensureArticleHtml(gated));
  }
  if (parts.length > 0) {
    return parts.join("\n");
  }
  return post.bodyHtml;
}

export function previewPostBodyHtml(post: AdminPostRecord): string {
  return preparePostBodyHtmlForRender(previewFullBodyHtml(post));
}
