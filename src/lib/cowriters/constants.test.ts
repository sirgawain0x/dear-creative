import { describe, expect, it } from "vitest";
import { MAX_COWRITERS_PER_POST } from "./constants";

describe("cowriter limits", () => {
  it("allows at most five co-writers per post", () => {
    expect(MAX_COWRITERS_PER_POST).toBe(5);
  });
});
