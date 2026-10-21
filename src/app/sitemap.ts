import type { MetadataRoute } from "next";
import { getDb } from "@/db/client";
import { listPublishedPosts } from "@/lib/posts/published-posts";
import { getPublicSiteOrigin } from "@/lib/posts/recent-feed";
import { resolvePostPublicUrl } from "@/lib/posts/post-public-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getPublicSiteOrigin();
  const { items } = await listPublishedPosts(getDb(), {
    page: 1,
    pageSize: 500,
  });

  const postEntries: MetadataRoute.Sitemap = items.map((post) => ({
    url: resolvePostPublicUrl({
      slug: post.slug,
      canonicalUrl: post.canonicalUrl,
    }),
    lastModified: post.publishedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: `${origin}/posts`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...postEntries,
  ];
}
