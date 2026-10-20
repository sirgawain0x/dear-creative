import Link from "next/link";
import { connection } from "next/server";
import { PostSpotlightCoverImage } from "@/components/home/post-spotlight-cover-image";
import { getCachedHomeSpotlightPosts } from "@/lib/posts/cached-home-spotlight-posts";
import { buildHomeSpotlightView } from "@/lib/posts/home-spotlight";
import { resolvePostCoverImage } from "@/lib/posts/post-cover-image";
import { buildPostSpotlightTeaser } from "@/lib/posts/post-spotlight-teaser";
import type { PublishedPostListItem } from "@/lib/posts/published-posts";

function SpotlightCard({
  post,
  priorityImage,
}: {
  post: PublishedPostListItem;
  priorityImage?: boolean;
}) {
  const teaser = buildPostSpotlightTeaser({
    excerpt: post.excerpt,
    bodyHtml: post.bodyHtml,
  });
  const coverSrc = resolvePostCoverImage({
    slug: post.slug,
    title: post.title,
    bodyHtml: post.bodyHtml,
    coverImage: post.coverImage,
  });

  return (
    <li className="group flex h-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700">
      <Link href={`/posts/${post.slug}`} className="flex flex-1 flex-col gap-3">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/80">
          <PostSpotlightCoverImage
            src={coverSrc}
            alt={post.title}
            priority={priorityImage}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-100 dark:group-hover:text-zinc-300">
            {post.title}
          </h3>
          <time
            dateTime={post.publishedAt}
            className="text-xs font-medium text-zinc-500"
          >
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          </time>
          {teaser ? (
            <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
              {teaser}
            </p>
          ) : null}
          <span className="mt-auto pt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Read dispatch →
          </span>
        </div>
      </Link>
    </li>
  );
}

export async function HomeSpotlight() {
  await connection();
  const posts = await getCachedHomeSpotlightPosts();
  const view = buildHomeSpotlightView(posts);

  return (
    <section
      aria-labelledby="home-spotlight-heading"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="home-spotlight-heading"
            className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Latest dispatches
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Three most recent published issues from the archive.
          </p>
        </div>
        <Link
          href="/posts"
          className="text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          View all posts →
        </Link>
      </div>

      {view.kind === "empty" ? (
        <p className="rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
          {view.message}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {view.posts.map((post, index) => (
            <SpotlightCard
              key={post.slug}
              post={post}
              priorityImage={index === 0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
