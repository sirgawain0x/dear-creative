import Link from "next/link";
import type {
  AuthorProfileRecord,
  AuthorPublishedArticle,
} from "@/lib/authors/author-profile";

export type AuthorProfileViewProps = {
  author: AuthorProfileRecord;
  articles: AuthorPublishedArticle[];
  editHref?: string | null;
};

export function AuthorProfileView({
  author,
  articles,
  editHref,
}: AuthorProfileViewProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <Link
          href="/posts"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← All posts
        </Link>
        {editHref ? (
          <Link
            href={editHref}
            className="inline-flex shrink-0 items-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Edit profile
          </Link>
        ) : null}
      </div>

      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            className="h-24 w-24 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
          />
        ) : (
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xl font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            aria-hidden
          >
            {author.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {author.name}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">@{author.slug}</p>
          {author.bio ? (
            <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              {author.bio}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Published articles
        </h2>
        {articles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No published articles yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {articles.map((article) => (
              <li key={article.id} className="py-4">
                <Link
                  href={`/posts/${encodeURIComponent(article.slug)}`}
                  className="group block min-w-0"
                >
                  <p className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
                    {article.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {article.publishedAtLabel ?? "Published"}
                    {article.role === "cowriter" ? " · Co-written" : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
