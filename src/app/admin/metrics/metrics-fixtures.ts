import type { MetricsData } from "./admin-metrics-client";

export const MOCK_METRICS_DATA: MetricsData = {
  subscribers: { total: 1284, delta7d: 42, delta30d: 156 },
  emailDelivery: {
    sent: 120,
    delivered: 115,
    failed: 2,
    pending: 3,
    needsReview: 0,
  },
  socialDelivery: {
    posted: 48,
    failed: 1,
    pending: 2,
    needsReview: 1,
  },
  tipsRevenue: {
    totalUsdc: "2500000",
    totalTips: 17,
    perPost: [
      { postId: "post-abc123", totalUsdc: "500000", tipCount: 3 },
    ],
  },
  feedback: { helpful: 89, notHelpful: 12 },
  topPosts: [
    {
      postId: "post-1",
      slug: "welcome",
      title: "Welcome dispatch",
      deliveryCount: 400,
    },
  ],
  adam: {
    threadsCount: 6,
    recentThreads: [
      {
        id: "thread-1",
        title: "Draft ideas",
        updatedAt: "2026-10-01T12:00:00.000Z",
      },
    ],
    recentMessageCount: 24,
  },
  publishedPostsCount: 32,
};
