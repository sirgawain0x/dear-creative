export type PostMeta = {
  slug: string;
  title: string;
  publishedAt: string;
  excerpt?: string;
  /** Public list/card copy: excerpt or free preview only (computed server-side). */
  teaser?: string;
  coverImage?: string;
  readMinutes?: number;
  listenMinutes?: number;
  readingTimeLabel?: string;
  topic?: "ai-ownership" | "creator-economics" | "onchain-culture";
};

export type RecentPost = PostMeta & {
  canonicalUrl: string;
  x402Url: string;
  /** True when paywall is on and the post is paid-only / subscriber content. */
  isGated: boolean;
};

