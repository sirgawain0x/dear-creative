import { describe, expect, it } from "vitest";
import { isWellFormedPostSlug, POST_SLUG_MAX_LENGTH } from "./post-slug-format";

describe("isWellFormedPostSlug", () => {
  it("accepts typical published slugs", () => {
    expect(isWellFormedPostSlug("hello-dear-creative")).toBe(true);
  });

  it("rejects empty, over-long, and malformed slugs", () => {
    expect(isWellFormedPostSlug("")).toBe(false);
    expect(isWellFormedPostSlug("a".repeat(POST_SLUG_MAX_LENGTH + 1))).toBe(
      false,
    );
    expect(isWellFormedPostSlug("Bad-Slug")).toBe(false);
    expect(isWellFormedPostSlug("-leading")).toBe(false);
    expect(isWellFormedPostSlug("trailing-")).toBe(false);
  });
});
