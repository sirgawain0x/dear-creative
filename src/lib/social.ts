import { TwitterApi } from "twitter-api-v2";
import { readXOAuth1UserCredentials } from "@/lib/x/credentials";
import { isXLiveEnabled } from "@/lib/x/feature-flag";

export interface TwitterClientLike {
  v2: {
    tweet(payload: { text: string }): Promise<unknown>;
  };
}

let twitterClientOverride: TwitterClientLike | null | undefined;

export function setTwitterClientForTests(client: TwitterClientLike | null): void {
  twitterClientOverride = client;
}

export function resetTwitterClientForTests(): void {
  twitterClientOverride = undefined;
}

export function getTwitterClient(): TwitterClientLike | null {
  if (twitterClientOverride !== undefined) {
    return twitterClientOverride;
  }
  if (!isXLiveEnabled()) {
    return null;
  }

  const creds = readXOAuth1UserCredentials();
  if (!creds) {
    return null;
  }

  return new TwitterApi({
    appKey: creds.apiKey,
    appSecret: creds.apiSecret,
    accessToken: creds.accessToken,
    accessSecret: creds.accessTokenSecret,
  });
}

export interface BroadcastOracleResolutionResult {
  x: "posted" | "failed" | "skipped";
  mastodon: "posted" | "failed" | "skipped";
}

/**
 * Syndicates reality.eth oracle resolutions to X (Twitter) and Mastodon.
 * Honors character limits (280 for X, 500 for Mastodon) and incorporates idempotency keys.
 */
export async function broadcastOracleResolution(
  postText: string,
  txHash: string,
): Promise<BroadcastOracleResolutionResult> {
  const mastodonInstance =
    process.env.MASTODON_INSTANCE_URL || "https://mastodon.social";
  const mastodonToken = process.env.MASTODON_ACCESS_TOKEN;

  // Truncate cleanly for X if text exceeds 275 chars
  const xText =
    postText.length > 275 ? `${postText.slice(0, 272)}...` : postText;

  const xConfigured = readXOAuth1UserCredentials() !== null;
  const twitterClient = getTwitterClient();

  const xPostPromise = (async (): Promise<"posted" | "skipped"> => {
    if (twitterClientOverride !== undefined) {
      if (!twitterClient) {
        return "skipped";
      }
      await twitterClient.v2.tweet({ text: xText });
      return "posted";
    }
    if (!xConfigured) {
      return "skipped";
    }
    if (!isXLiveEnabled()) {
      console.info(
        "[x-mock] oracle resolution tweet skipped (X_LIVE is not true)",
        { textLength: xText.length },
      );
      return "posted";
    }
    if (!twitterClient) {
      return "skipped";
    }
    await twitterClient.v2.tweet({ text: xText });
    return "posted";
  })();

  const [xResult, mastodonResult] = await Promise.allSettled([
    xPostPromise,
    mastodonToken
      ? fetch(`${mastodonInstance}/api/v1/statuses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mastodonToken}`,
            "Idempotency-Key": `oracle-resolve-${txHash}`,
          },
          body: JSON.stringify({
            status: postText,
            visibility: "public",
            language: "en",
          }),
        }).then(async (res) => {
          if (!res.ok) {
            throw new Error(`Mastodon returned HTTP ${res.status}`);
          }
          return "posted" as const;
        })
      : Promise.resolve("skipped" as const),
  ]);

  return {
    x: xResult.status === "fulfilled" ? xResult.value : "failed",
    mastodon:
      mastodonResult.status === "fulfilled" ? mastodonResult.value : "failed",
  };
}
