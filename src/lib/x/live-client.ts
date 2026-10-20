import type { XOAuth2Credentials } from "./credentials";
import { formatXApiFailure } from "./api-errors";
import type { FetchLike } from "./oauth2";
import { refreshOAuth2AccessToken } from "./oauth2";
import type { XClient, XPostPayload, XPostResult } from "./types";

const CREATE_TWEET_URL = "https://api.x.com/2/tweets";

type CreateTweetResponse = {
  data?: { id?: string };
};

export class OAuth2UserContextXClient implements XClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAtMs = 0;

  constructor(
    private readonly creds: XOAuth2Credentials,
    private readonly fetchFn: FetchLike,
  ) {}

  async postTweet(payload: XPostPayload): Promise<XPostResult> {
    const accessToken = await this.getAccessToken();
    const response = await this.fetchFn(CREATE_TWEET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAtMs - 60_000) {
      return this.accessToken;
    }

    const token = await refreshOAuth2AccessToken(this.creds, this.fetchFn);
    if (!token.access_token?.trim()) {
      throw new Error("X OAuth token refresh returned no access_token");
    }

    this.accessToken = token.access_token.trim();
    const expiresInSec =
      typeof token.expires_in === "number" && token.expires_in > 0
        ? token.expires_in
        : 7200;
    this.accessTokenExpiresAtMs = now + expiresInSec * 1000;
    return this.accessToken;
  }
}
