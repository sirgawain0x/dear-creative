import { describe, expect, it } from "vitest";
import {
  HOME_SPOTLIGHT_EMPTY_MESSAGE,
  HOME_SPOTLIGHT_LIMIT,
  buildHomeSpotlightView,
} from "./home-spotlight";
import type { PublishedPostListItem } from "./published-posts";

function samplePost(slug: string): PublishedPostListItem {
  return {
    slug,
    title: slug,
    publishedAt: "2024-01-01T00:00:00.000Z",
    canonicalUrl: null,
    coverImage: "data:image/svg+xml;utf8,%3Csvg/%3E",
  };
}

describe("home spotlight view", () => {
  it("uses a homepage limit between 10 and 12 inclusive", () => {
    expect(HOME_SPOTLIGHT_LIMIT).toBeGreaterThanOrEqual(10);
    expect(HOME_SPOTLIGHT_LIMIT).toBeLessThanOrEqual(12);
  });

  it("shows a tidy empty state when there are no posts", () => {
    const view = buildHomeSpotlightView([]);
    expect(view).toEqual({
      kind: "empty",
      message: HOME_SPOTLIGHT_EMPTY_MESSAGE,
    });
  });

  it("passes through one or two posts without padding", () => {
    const one = buildHomeSpotlightView([samplePost("alpha")]);
    expect(one.kind).toBe("posts");
    if (one.kind === "posts") {
      expect(one.posts).toHaveLength(1);
    }

    const two = buildHomeSpotlightView([
      samplePost("alpha"),
      samplePost("beta"),
    ]);
    if (two.kind === "posts") {
      expect(two.posts.map((p) => p.slug)).toEqual(["alpha", "beta"]);
    }
  });
});
