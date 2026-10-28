export function PreviewNotPublishedBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="preview-not-published-banner"
    >
      Preview, not published
    </div>
  );
}
