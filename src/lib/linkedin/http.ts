export type LinkedInFetch = typeof fetch;

let fetchOverride: LinkedInFetch | undefined;

export function setLinkedInFetchForTests(fetchFn: LinkedInFetch | undefined): void {
  fetchOverride = fetchFn;
}

export function linkedInFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const fn = fetchOverride ?? fetch;
  return fn(input, init);
}
