import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/lib/posts/published-posts";
import { resolveReaderPostView } from "@/lib/paywall/reader-post";

export type GatedReaderPostView = NonNullable<
  Awaited<ReturnType<typeof resolveReaderPostView>>
>;

/**
 * Post reader routes must call this before any Suspense boundary so
 * notFound() yields a real HTTP 404 under cacheComponents / PPR.
 * Existence is checked before connection() so we do not open the dynamic
 * stream for missing slugs.
 */
export async function gatePublishedPostPage(
  slug: string,
): Promise<GatedReaderPostView> {
  const published = await getPublishedPostBySlug(getDb(), slug);
  if (!published) {
    notFound();
  }
  await connection();
  const view = await resolveReaderPostView(slug);
  if (!view) {
    notFound();
  }
  return view;
}

/**
 * Metadata and PPR status codes: call from generateMetadata (and the page shell
 * before Suspense) so notFound() runs before the response streams.
 */
export async function gatePublishedPostMetadata(slug: string) {
  const published = await getPublishedPostBySlug(getDb(), slug);
  if (!published) {
    notFound();
  }
  return published;
}
