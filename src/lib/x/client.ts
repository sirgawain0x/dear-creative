import { readXOAuth2Credentials } from "./credentials";
import { isXLiveEnabled } from "./feature-flag";
import { OAuth2UserContextXClient } from "./live-client";
import { loggingMockXClient } from "./mock-client";
import type { FetchLike } from "./oauth2";
import type { XClient } from "./types";

export type { XClient, XPostPayload, XPostResult } from "./types";

let clientOverride: XClient | null | undefined;
let liveClientSingleton: XClient | null | undefined;
let fetchOverride: FetchLike | undefined;

export function setXClientForTests(client: XClient | null): void {
  clientOverride = client;
}

export function resetXClientForTests(): void {
  clientOverride = undefined;
  liveClientSingleton = undefined;
  fetchOverride = undefined;
}

export function setXFetchForTests(fetchFn: FetchLike | undefined): void {
  fetchOverride = fetchFn;
  liveClientSingleton = undefined;
}

function getFetchFn(): FetchLike {
  return fetchOverride ?? fetch;
}

export function getXClient(): XClient | null {
  if (clientOverride !== undefined) {
    return clientOverride;
  }

  const creds = readXOAuth2Credentials();
  if (!creds) {
    return null;
  }

  if (!isXLiveEnabled()) {
    return loggingMockXClient;
  }

  if (!liveClientSingleton) {
    liveClientSingleton = new OAuth2UserContextXClient(creds, getFetchFn());
  }
  return liveClientSingleton;
}
