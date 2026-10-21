import Link from "next/link";
import { AUTHOR_PROFILE_PREVIEW } from "./author-profile-preview";

/** Signed-in edit form markup for screenshot harnesses (no Privy). */
export function AuthorProfileEditPreviewStatic() {
  const author = AUTHOR_PROFILE_PREVIEW;
  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <Link
        href={`/authors/${encodeURIComponent(author.id)}`}
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Edit profile
      </h1>

      <div className="mt-8 space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Display name
          </span>
          <input
            type="text"
            readOnly
            value={author.name}
            className="mt-2 w-full max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Profile image
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold dark:bg-zinc-800">
              {author.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="max-w-full text-sm text-zinc-500">Choose file…</span>
          </div>
        </div>

        <button
          type="button"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save changes
        </button>
      </div>
    </main>
  );
}
