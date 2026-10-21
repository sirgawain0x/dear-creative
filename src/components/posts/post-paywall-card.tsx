type PostPaywallCardProps = {
  title: string;
};

/** Placeholder paywall CTA — checkout wiring lands in PR C. */
export function PostPaywallCard({ title }: PostPaywallCardProps) {
  return (
    <section
      className="my-10 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30"
      aria-labelledby="post-paywall-heading"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        Subscriber content
      </p>
      <h2
        id="post-paywall-heading"
        className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Continue reading &ldquo;{title}&rdquo;
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Subscribe to this writer or unlock this post to read the full piece.
        Payment checkout will be available in a follow-up release.
      </p>
      <button
        type="button"
        disabled
        className="mt-6 cursor-not-allowed rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Unlock — coming soon
      </button>
    </section>
  );
}
