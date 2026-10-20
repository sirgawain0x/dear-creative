export type XPostPayload = {
  text: string;
};

export type XPostResult = { tweetId: string };

export interface XClient {
  postTweet(payload: XPostPayload): Promise<XPostResult>;
}
