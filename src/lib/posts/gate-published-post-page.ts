import { cache } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import type { PublishedPostDetail } from "@/lib/posts/published-posts";
import { resolveReaderPostView } from "@/lib/paywall/reader-post";

export type GatedReaderPostView = NonNullable<
  Awaited<ReturnType<typeof resolveReaderPostView>>
>;

export function isNextProductionBuildPhase(): boolean {
  const phase = process.env.NEXT_PHASE;
  return phase === "phase-production-build" || phase === "phase-export";
}

/** Stable as-of during prerender so published lookups do not call `new Date()`. */
export function buildStablePublishedAsOf(): Date {
  return new Date("2099-12-31T23:59:59.999Z");
}

async function publishedAsOfForLookup(): Promise<Date> {
  if (isNextProductionBuildPhase()) {
    return buildStablePublishedAsOf();
  }
  await connection();
  return new Date();
}

async function publishedLookupOptions(): Promise<{ asOf: Date }> {
  return { asOf: await publishedAsOfForLookup() };
}

/** Uncached existence gate for HTTP status (metadata + page shell). */
export async function rejectMissingPublishedPostSlug(slug: string): Promise<void> {
  const published = await getPublishedPostBySlug(
    getDb(),
    slug,
    await publishedLookupOptions(),
  );
  if (!published) {
    notFound();
  }
}

/** One published-post fetch per request (body reuse after the slug gate). */
export const requirePublishedPostBySlug = cache(
  async (slug: string): Promise<PublishedPostDetail> => {
    const published = await getPublishedPostBySlug(
      getDb(),
      slug,
      await publishedLookupOptions(),
    );
    if (!published) {
      notFound();
    }
    return published;
  },
);

/**
 * Post reader routes: call rejectMissingPublishedPostSlug before Suspense and in
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
