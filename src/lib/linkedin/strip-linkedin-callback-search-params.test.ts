import { describe, expect, it } from "vitest";
import { stripLinkedInCallbackSearchParams } from "./strip-linkedin-callback-search-params";

describe("stripLinkedInCallbackSearchParams", () => {
  it("removes linkedin and reason while keeping other params", () => {
    const url = new URL(
      "https://dear.example/admin?linkedin=error&reason=invalid_state&tab=metrics",
    );
    expect(stripLinkedInCallbackSearchParams(url)).toBe("/admin?tab=metrics");
  });

  it("returns pathname only when no params remain", () => {
    const url = new URL(
      "https://dear.example/admin?linkedin=connected",
    );
    expect(stripLinkedInCallbackSearchParams(url)).toBe("/admin");
  });
});
