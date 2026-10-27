import Link from "next/link";
import { connection } from "next/server";
import { AuthorByline } from "@/components/posts/author-byline";
import { getDb } from "@/db/client";
import { getAuthorBySlug } from "@/lib/posts/post-author";

export const HOME_PUBLICATION_AUTHOR_SLUG = "g2";

export const HOME_ABOUT_PLACEHOLDER = {
  name: "G2",
  slug: HOME_PUBLICATION_AUTHOR_SLUG,
  bio: "[Placeholder] Editor of Dear Creative and builder at Creative Platform. Author profile copy will appear here once loaded from the writers table.",
} as const;

export async function HomeAboutSection() {
  await connection();
  const loaded = await getAuthorBySlug(getDb(), HOME_PUBLICATION_AUTHOR_SLUG);
  const usedFallback = loaded === null;
  const author = loaded ?? HOME_ABOUT_PLACEHOLDER;
  const bio =
    author.bio ??
    (usedFallback
      ? HOME_ABOUT_PLACEHOLDER.bio
      : "Writer bio coming soon.");

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
      <p
        className={`text-base leading-relaxed text-zinc-600 dark:text-zinc-400 ${usedFallback ? "italic" : ""}`}
      >
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
