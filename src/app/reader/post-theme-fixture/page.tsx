/** Static post layout fixture for theme / typography screenshots (no DB). */
export default function PostThemeFixturePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16" data-testid="post-theme-fixture">
      <header className="mb-8 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-500">October 29, 2026 · 6 min read</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Theme fixture: dispatch typography
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Sample excerpt for light and dark contrast checks on real post chrome.
        </p>
      </header>

      <div
        className="prose prose-zinc dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{
          __html: `
<p>Body copy uses comfortable line height and zinc tones for WCAG AA on white and near-black backgrounds.</p>
<h2>Section heading</h2>
<p>Inline <a href="https://creativeplatform.xyz">platform link</a> and <code>const x = 1</code> samples.</p>
<blockquote><p>A blockquote with italic emphasis for pull quotes.</p></blockquote>
<pre><code>export function hello(name: string) {
  return \`Hello, \${name}\`;
}</code></pre>
<p><img src="https://placehold.co/800x420/png?text=Cover+fixture" alt="Placeholder cover" width="800" height="420" /></p>
`,
        }}
      />

      <section
        className="my-10 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-8 dark:border-amber-900/50 dark:bg-amber-950/30"
        aria-labelledby="post-paywall-heading"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Subscriber content
        </p>
        <h2
          id="post-paywall-heading"
          className="mt-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Continue reading &ldquo;Theme fixture: dispatch typography&rdquo;
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
          Unlock this post with a one-time USDC payment on Base. Pay directly to the writer&apos;s
          split with your Privy wallet.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Unlock this post · 1 USDC
          </button>
          <p className="max-w-md text-center text-xs text-zinc-600 dark:text-zinc-400">
            Writer subscriptions ($8 / 30 days or $80 / 365 days) will use{" "}
            <strong>Unlock Protocol</strong> with auto-renewal — scope only.
          </p>
        </div>
      </section>
    </article>
  );
}
