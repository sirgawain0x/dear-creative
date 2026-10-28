import Link from "next/link";
import { connection } from "next/server";
import { AuthorByline } from "@/components/posts/author-byline";
import { getDb } from "@/db/client";
import { getAuthorBySlug } from "@/lib/posts/post-author";

export const HOME_PUBLICATION_AUTHOR_SLUG = "g2";

export async function HomeAboutSection() {
  await connection();
  const author = await getAuthorBySlug(getDb(), HOME_PUBLICATION_AUTHOR_SLUG);
  const bio = author?.bio?.trim();
  if (!author || !bio) {
    return null;
  }

  return (
    <section
      aria-labelledby="home-about-heading"
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/40 md:p-8"
    >
      <h2
        id="home-about-heading"
        className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        About this publication
      </h2>
      <AuthorByline author={author} className="border-none pb-0" />
      <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
        {bio}
      </p>
      {author.slug ? (
        <Link
          href={`/writers/${encodeURIComponent(author.slug)}`}
          className="text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          Full writer profile →
        </Link>
      ) : null}
    </section>
  );
}
