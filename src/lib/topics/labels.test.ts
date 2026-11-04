import { describe, expect, it } from "vitest";
import {
  TOPIC_KEYS,
  TOPIC_LABELS,
  getTopicLabel,
  type TopicKey,
} from "./labels";

describe("topic labels", () => {
  it("maps each topic key to a human label", () => {
    expect(TOPIC_LABELS).toEqual({
      "ai-ownership": "AI & Ownership",
      "creator-economics": "Getting Paid",
      "onchain-culture": "Internet Culture",
    });
  });

  it("getTopicLabel returns labels and never echoes raw keys", () => {
    for (const key of TOPIC_KEYS) {
      const label = getTopicLabel(key);
      expect(label).toBe(TOPIC_LABELS[key]);
      expect(label).not.toBe(key);
      expect(label).not.toContain("-");
    }
  });

  it("falls back to Getting Paid for unknown keys", () => {
    expect(getTopicLabel("unknown-topic")).toBe("Getting Paid");
  });

  it("falls back for prototype property names such as toString", () => {
    expect(getTopicLabel("toString")).toBe("Getting Paid");
  });

  it("covers every declared topic key", () => {
    const keys: TopicKey[] = [
      "ai-ownership",
      "creator-economics",
      "onchain-culture",
    ];
    expect(TOPIC_KEYS.sort()).toEqual(keys.sort());
  });
});
