import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PreviewNotPublishedBanner } from "@/components/posts/preview-not-published-banner";
import { getDb } from "@/db/client";
import { isPreviewLinksEnabled } from "@/lib/preview-links/feature-flag";
import { resolvePreviewLinkByToken } from "@/lib/preview-links/links";
import { previewPostBodyHtml } from "@/lib/preview-links/preview-post-body";
import {
  PREVIEW_PAGE_CACHE_CONTROL,
  PREVIEW_PAGE_X_ROBOTS_TAG,
} from "@/lib/preview-links/preview-response-headers";
import { calculateReadingTime } from "@/lib/posts/reading-time";
import { getAdminPostByIdOrSlug } from "@/lib/posts/manage-posts";
import { resolvePublicPostCoverImage } from "@/lib/posts/post-cover-image";

export async function headers() {
  return {
    "Cache-Control": PREVIEW_PAGE_CACHE_CONTROL,
    "X-Robots-Tag": PREVIEW_PAGE_X_ROBOTS_TAG,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Preview",
    robots: {
      index: false,
      follow: false,
    },
  };
}

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PostPreviewPage({ params }: PageProps) {
  if (!isPreviewLinksEnabled()) {
    notFound();
  }

  await connection();
  const { token } = await params;
  const resolved = await resolvePreviewLinkByToken(getDb(), token);
  if (!resolved.ok) {
    notFound();
  }

  const post = await getAdminPostByIdOrSlug(getDb(), resolved.postId);
  if (!post || post.status === "published") {
    notFound();
  }

  const bodyHtml = previewPostBodyHtml(post);
  const coverImage = resolvePublicPostCoverImage({
    slug: post.slug,
    title: post.title,
    bodyHtml,
  });
  const metrics = calculateReadingTime(bodyHtml ?? post.teaserText);

  return (
    <>
      <PreviewNotPublishedBanner />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <img
            src={coverImage}
            alt={post.title}
            className="aspect-[21/9] w-full object-cover"
          />
        </div>

        <header className="mb-8 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {post.title}
          </h1>
          {post.teaserText ? (
            <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
              {post.teaserText}
            </p>
          ) : null}
          <p className="mt-4 text-xs font-medium text-zinc-500">
            <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
              <span>⏱</span> {metrics.label}
            </span>
          </p>
        </header>

        <div
          className="prose prose-zinc max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </>
  );
}
