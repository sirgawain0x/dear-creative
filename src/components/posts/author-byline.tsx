import type { PostAuthorDetail } from "@/lib/posts/post-author";

export type AuthorBylineProps = {
  author: PostAuthorDetail;
  publishedDate?: string;
  className?: string;
};

/** Display-only author row for post bylines and writer profiles (no wallet/trade UI). */
export function AuthorByline({
  author,
  publishedDate,
  className = "",
}: AuthorBylineProps) {
  const showPatronBadge = Boolean(
    author.meTokenAddress?.trim() && author.meTokenSymbol?.trim(),
  );
  const patronSymbol = author.meTokenSymbol?.trim();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 py-4 border-b border-zinc-200 dark:border-zinc-800 ${className}`}
      data-testid="author-byline"
    >
      <div className="flex items-center gap-3">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.name}
            className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-semibold text-sm text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
            {author.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 flex-wrap">
            {author.slug ? (
              <a
                href={`/writers/${encodeURIComponent(author.slug)}`}
                className="hover:underline"
              >
                {author.name}
              </a>
            ) : (
              <span>{author.name}</span>
            )}
            {author.slug ? (
              <span className="text-xs text-zinc-500 font-normal">
                @{author.slug}
              </span>
            ) : null}
          </div>
          {author.bio ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {author.bio}
            </p>
          ) : publishedDate ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {publishedDate}
            </p>
          ) : null}
        </div>
      </div>

      {showPatronBadge && patronSymbol ? (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
          data-testid="author-patron-badge"
        >
          Patron token: ${patronSymbol}
        </span>
      ) : null}
    </div>
  );
}
