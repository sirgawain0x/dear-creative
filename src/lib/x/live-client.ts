import type { XOAuth1UserCredentials } from "./credentials";
import { formatXApiFailure } from "./api-errors";
import type { FetchLike } from "./fetch-like";
import {
  generateOAuthNonce,
  oauthTimestampSeconds,
  signOAuth1Request,
} from "./oauth1-sign";
import type { XClient, XPostPayload, XPostResult } from "./types";

const CREATE_TWEET_URL = "https://api.x.com/2/tweets";

type CreateTweetResponse = {
  data?: { id?: string };
};

export type OAuth1SigningHooks = {
  nonce: () => string;
  timestamp: () => string;
};

let signingHooksOverride: OAuth1SigningHooks | undefined;

export function setOAuth1SigningHooksForTests(
  hooks: OAuth1SigningHooks | undefined,
): void {
  signingHooksOverride = hooks;
}

function resolveSigningHooks(): OAuth1SigningHooks {
  return (
    signingHooksOverride ?? {
      nonce: generateOAuthNonce,
      timestamp: () => oauthTimestampSeconds(),
    }
  );
}

export class OAuth1UserContextXClient implements XClient {
  constructor(
    private readonly creds: XOAuth1UserCredentials,
    private readonly fetchFn: FetchLike,
    private readonly signingHooks: OAuth1SigningHooks = resolveSigningHooks(),
  ) {}

  async postTweet(payload: XPostPayload): Promise<XPostResult> {
    const { authorizationHeader } = signOAuth1Request({
      method: "POST",
      baseUrl: CREATE_TWEET_URL,
      consumerKey: this.creds.apiKey,
      consumerSecret: this.creds.apiSecret,
      accessToken: this.creds.accessToken,
      accessTokenSecret: this.creds.accessTokenSecret,
      nonce: this.signingHooks.nonce(),
      timestamp: this.signingHooks.timestamp(),
    });

    const response = await this.fetchFn(CREATE_TWEET_URL, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: payload.text }),
    });

    if (!response.ok) {
      throw new Error(await formatXApiFailure(response));
    }

    const json = (await response.json()) as CreateTweetResponse;
    const tweetId = json.data?.id?.trim();
    if (!tweetId) {
      throw new Error("X API create post response missing data.id");
    }
    return { tweetId };
  }
}
