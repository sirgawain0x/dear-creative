export type TopicKey =
  | "ai-ownership"
  | "creator-economics"
  | "onchain-culture";

export const TOPIC_LABELS: Record<TopicKey, string> = {
  "ai-ownership": "AI & Ownership",
  "creator-economics": "Getting Paid",
  "onchain-culture": "Internet Culture",
};

export const TOPIC_KEYS = Object.keys(TOPIC_LABELS) as TopicKey[];

export function getTopicLabel(topic: TopicKey | string): string {
  if (Object.hasOwn(TOPIC_LABELS, topic)) {
    return TOPIC_LABELS[topic as TopicKey];
  }
  return TOPIC_LABELS["creator-economics"];
}
