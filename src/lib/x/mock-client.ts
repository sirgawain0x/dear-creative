import type { XClient, XPostPayload, XPostResult } from "./types";

export const loggingMockXClient: XClient = {
  async postTweet(payload: XPostPayload): Promise<XPostResult> {
    console.info(
      "[x-mock] tweet skipped (X_LIVE is not true)",
      { textLength: payload.text.length },
    );
    return { tweetId: "mock-x-dry-run" };
  },
};
