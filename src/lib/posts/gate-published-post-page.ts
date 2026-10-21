import { cache } from "react";
import { notFound } from "next/navigation";

/** Ensures PPR shell is a 404 template at build; no effect on live requests. */
export function abortPostReaderMetadataAtBuild(): void {
  const phase = process.env.NEXT_PHASE;
  if (phase === "phase-production-build" || phase === "phase-export") {
    notFound();
  }
}
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import type { PublishedPostDetail } from "@/lib/posts/published-posts";
import { resolveReaderPostView } from "@/lib/paywall/reader-post";

export type GatedReaderPostView = NonNullable<
  Awaited<ReturnType<typeof resolveReaderPostView>>
>;

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
