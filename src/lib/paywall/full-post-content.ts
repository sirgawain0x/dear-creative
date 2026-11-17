import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb, type DearCreativeDb } from "@/db/client";
import { posts } from "@/db/schema";
import { htmlToMarkdown } from "@/lib/html/html-to-markdown";
import { preparePostBodyHtmlForRender } from "@/lib/posts/body-html-for-render";
import type { ContentPostSlug } from "@/lib/posts/content-slugs";
import { isContentPostSlug, listContentPosts } from "@/lib/posts/get-post";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";

export type FullPostPayload = {
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  bodyHtml?: string;
  publishedAt: string;
};

function readMdxBody(slug: ContentPostSlug): string {
  const filePath = join(process.cwd(), "content", `${slug}.mdx`);
  const raw = readFileSync(filePath, "utf8");
  const withoutExport = raw.replace(/^export[\s\S]*?;\n\n/m, "");
  return withoutExport.trim();
}

export async function loadFullPostContent(
  slug: string,
  dbOverride?: DearCreativeDb,
): Promise<FullPostPayload | null> {
  const trimmedSlug = slug.trim();
  if (!trimmedSlug) {
    return null;
  }

  // 1. Try published posts in Turso / SQLite database first
  try {
    const db = dbOverride ?? getDb();
    const published = await getPublishedPostBySlug(db, trimmedSlug);
    if (published) {
      const safeHtml = preparePostBodyHtmlForRender(published.bodyHtml);
      const markdownBody = htmlToMarkdown(published.bodyHtml) || safeHtml;
      return {
        slug: published.slug,
        title: published.title,
        excerpt: published.excerpt,
        body: markdownBody,
        bodyHtml: safeHtml,
        publishedAt: published.publishedAt,
      };
    }
    if (isContentPostSlug(trimmedSlug)) {
      const [stored] = await db.select({ id: posts.id }).from(posts)
        .where(eq(posts.slug, trimmedSlug)).limit(1);
      if (stored) return null;
    }
  } catch {
    // Fall back to static MDX content if DB is unavailable or unmigrated in unit tests
  }

  // 2. Fallback to static MDX content (e.g. hello-dear-creative)
  if (!isContentPostSlug(trimmedSlug)) {
    return null;
  }
  const meta = listContentPosts().find((post) => post.slug === trimmedSlug);
  if (!meta) {
    return null;
  }
  return {
    slug: meta.slug,
    title: meta.title,
    excerpt: meta.excerpt,
    body: readMdxBody(trimmedSlug),
    publishedAt: meta.publishedAt,
  };
}
