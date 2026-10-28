const LINKEDIN_PARAM = "linkedin";
const REASON_PARAM = "reason";

/** Returns pathname + search (no origin) with LinkedIn callback query params removed. */
export function stripLinkedInCallbackSearchParams(url: URL): string {
  const next = new URL(url.href);
  next.searchParams.delete(LINKEDIN_PARAM);
  next.searchParams.delete(REASON_PARAM);
  const query = next.searchParams.toString();
  return query ? `${next.pathname}?${query}` : next.pathname;
}
