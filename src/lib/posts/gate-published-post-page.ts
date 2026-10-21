import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import type { PublishedPostDetail } from "@/lib/posts/published-posts";
import { resolveReaderPostView } from "@/lib/paywall/reader-post";

export type GatedReaderPostView = NonNullable<
  Awaited<ReturnType<typeof resolveReaderPostView>>
>;

/** Skip slug-specific metadata during static build (PPR shell); live requests still gate. */
export function shouldSkipPostReaderMetadataAtBuild(): boolean {
  const phase = process.env.NEXT_PHASE;
  return phase === "phase-production-build" || phase === "phase-export";
}

/** One published-post fetch per request (metadata, page shell, and body). */
export const requirePublishedPostBySlug = cache(
  async (slug: string): Promise<PublishedPostDetail> => {
    const published = await getPublishedPostBySlug(getDb(), slug);
    if (!published) {
      notFound();
    }
    return published;
  },
);

/**
 * Post reader routes: call requirePublishedPostBySlug before Suspense and in
 * generateMetadata so notFound() runs before streaming under cacheComponents.
 */
export async function resolveGatedReaderPostView(
  slug: string,
): Promise<GatedReaderPostView> {
  await requirePublishedPostBySlug(slug);
  const view = await resolveReaderPostView(slug);
  if (!view) {
    notFound();
  }
  return view;
}
