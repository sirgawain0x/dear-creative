import Link from "next/link";
import Script from "next/script";
import { Suspense, type ComponentProps } from "react";
import type { Address } from "viem";
import { DispatchAudioPlayer } from "@/components/audio/dispatch-audio-player";
import { OwnerEditPostButton } from "@/components/auth/owner-edit-controls";
import { MicroTippingWidget } from "@/components/monetization/micro-tipping-widget";
import { PredictionCard } from "@/components/predictions/prediction-card";
import { PostFeedbackWidget } from "@/components/posts/post-feedback-widget";
import { PostKeyTakeaways } from "@/components/posts/post-key-takeaways";
import { AuthorByline } from "@/components/posts/author-byline";
import { PostPaywallCheckout } from "@/components/posts/post-paywall-checkout";
import { PostShareButton } from "@/components/posts/post-share-button";
import { PostRepurposeSection } from "@/components/posts/repurpose/post-repurpose-section";
import { shouldRenderPostRepurposeSection } from "@/lib/posts/post-repurpose-visibility";
import { splitArticleAtParagraph } from "@/lib/posts/post-takeaway-inline";
import { publishedPostBodyForDisplay } from "@/lib/posts/published-post-render";
import type { PublishedPostDetail } from "@/lib/posts/published-posts";
import { calculateReadingTime } from "@/lib/posts/reading-time";
import { buildPostPageMetadata } from "@/lib/posts/post-page-metadata";
import { resolvePostPublicUrl } from "@/lib/posts/post-public-url";
import {
  resolvePostTipPayToAddress,
  shouldRenderPostTipCard,
} from "@/lib/posts/post-tip-payee";
import {
  rejectMissingPublishedPostSlug,
  requirePublishedPostBySlug,
  resolveGatedReaderPostView,
} from "@/lib/posts/gate-published-post-page";
import { getDb } from "@/db/client";
import {
  classifyArticleTopic,
  getTopicLabel,
} from "@/lib/posts/topic-tagging";

export const instant = false;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function PostArticle({
  post,
  payToAddress,
  showPaywall,
  paywallCheckout,
}: {
  post: PublishedPostDetail;
  payToAddress: Address | null;
  showPaywall: boolean;
  paywallCheckout: Omit<
    ComponentProps<typeof PostPaywallCheckout>,
    "title"
  > | null;
}) {
  const bodyHtml = publishedPostBodyForDisplay(post.bodyHtml);
  const metrics = calculateReadingTime(post.bodyHtml ?? post.excerpt);
  const topic = classifyArticleTopic({
    title: post.title,
    excerpt: post.excerpt,
    bodyHtml: post.bodyHtml,
  });

  const { introHtml, restHtml } = splitArticleAtParagraph(bodyHtml, 2);

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/posts"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← All Posts
        </Link>
        <OwnerEditPostButton slug={post.slug} label="✎ Edit Post" />
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <img
          src={post.coverImage}
          alt={post.title}
          className="aspect-[21/9] w-full object-cover"
        />
      </div>

      <header className="mb-8 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              dateStyle: "long",
            })}
          </time>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
            <span>⏱</span> {metrics.label}
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {getTopicLabel(topic)}
          </span>
        </div>

        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {post.title}
          </h1>
          <PostShareButton
            title={post.title}
            url={resolvePostPublicUrl({
              slug: post.slug,
              canonicalUrl: post.canonicalUrl,
            })}
          />
        </div>
        {post.bylineWriters && post.bylineWriters.length > 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            By{" "}
            {post.bylineWriters.map((writer, index) => (
              <span key={`${writer.role}-${writer.label}-${index}`}>
                {index > 0 ? (index === post.bylineWriters!.length - 1 ? ", and " : ", ") : null}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {writer.label}
                </span>
              </span>
            ))}
          </p>
        ) : null}
        {post.excerpt ? (
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            {post.excerpt}
          </p>
        ) : null}

        {post.author ? (
          <div className="mt-6">
            <AuthorByline
              author={post.author}
              publishedDate={new Date(post.publishedAt).toLocaleDateString(
                "en-US",
                { dateStyle: "medium" },
              )}
            />
          </div>
        ) : null}
      </header>

      {!showPaywall ? (
        <DispatchAudioPlayer
          slug={post.slug}
          title={post.title}
          excerpt={post.excerpt}
          bodyHtml={bodyHtml}
          listenMinutes={metrics.listenMinutes}
          audioUrl={post.audioUrl}
          audioVoice={post.audioVoice}
        />
      ) : null}

      {bodyHtml ? (
        restHtml ? (
          <>
            <div
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: introHtml }}
            />

            <PostKeyTakeaways
              takeaway={post.excerpt}
              title={post.title}
            />

            <div
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: restHtml }}
            />
          </>
        ) : (
          <>
            <PostKeyTakeaways
              takeaway={post.excerpt}
              title={post.title}
            />
            <div
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </>
        )
      ) : null}

      {showPaywall && paywallCheckout ? (
        <PostPaywallCheckout title={post.title} {...paywallCheckout} />
      ) : null}

      {shouldRenderPostTipCard(payToAddress) ? (
        <MicroTippingWidget
          slug={post.slug}
          postTitle={post.title}
          payToAddress={payToAddress}
        />
      ) : null}

      {shouldRenderPostRepurposeSection(showPaywall) ? (
        <PostRepurposeSection slug={post.slug} />
      ) : null}

      <PredictionCard slug={post.slug} />

      <PostFeedbackWidget slug={post.slug} />

      <Script
        src="https://platform.twitter.com/widgets.js"
        strategy="lazyOnload"
      />
    </article>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  await rejectMissingPublishedPostSlug(slug);
  const post = await requirePublishedPostBySlug(slug);
  return buildPostPageMetadata(post);
}

async function PostPageBody({ slug }: { slug: string }) {
  const view = await resolveGatedReaderPostView(slug);
  const payToAddress = await resolvePostTipPayToAddress(getDb(), slug);
  return (
    <PostArticle
      post={view.post}
      payToAddress={payToAddress}
      showPaywall={view.showPaywall}
      paywallCheckout={view.paywallCheckout}
    />
  );
}

export default async function PostPage(props: PageProps) {
  const { slug } = await props.params;
  await rejectMissingPublishedPostSlug(slug);

  return (
    <Suspense
      fallback={
        <p
          className="mx-auto max-w-3xl px-6 py-16 text-sm text-zinc-500"
          aria-busy="true"
        >
          Loading dispatch…
        </p>
      }
    >
      <PostPageBody slug={slug} />
    </Suspense>
  );
}
