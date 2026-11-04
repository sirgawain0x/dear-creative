/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { ADAM_USER_BUBBLE_BODY_CLASS } from "./adam-studio";

describe("Adam user chat bubble contrast", () => {
  it("keeps prose typography with inherited high-contrast text", () => {
    expect(ADAM_USER_BUBBLE_BODY_CLASS).toContain("prose prose-sm");
    expect(ADAM_USER_BUBBLE_BODY_CLASS).toContain("prose-inherit-color");
    expect(ADAM_USER_BUBBLE_BODY_CLASS).not.toContain("prose-invert");
  });
});
