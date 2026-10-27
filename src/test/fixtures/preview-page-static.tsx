import { PreviewNotPublishedBanner } from "@/components/posts/preview-not-published-banner";

/** Static preview page slice for screenshot harnesses. */
export function PreviewPageFixture() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <PreviewNotPublishedBanner />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-8 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Studio draft: Product roadmap Q4
          </h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            Mock preview body for stakeholders — not indexed or published.
          </p>
        </header>
        <div className="prose prose-zinc max-w-none dark:prose-invert">
          <p>
            This paragraph stands in for the full draft HTML, including any paid
            sections that would normally sit behind the paywall.
          </p>
        </div>
      </article>
    </div>
  );
}
