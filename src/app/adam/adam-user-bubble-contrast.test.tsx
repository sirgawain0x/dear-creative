/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { ADAM_USER_BUBBLE_BODY_CLASS } from "./adam-studio";

describe("Adam user chat bubble contrast", () => {
  it("uses inherit text on markdown body instead of prose gray defaults", () => {
    expect(ADAM_USER_BUBBLE_BODY_CLASS).toContain("[&_p]:text-inherit");
    expect(ADAM_USER_BUBBLE_BODY_CLASS).not.toContain("prose-sm");
  });
});
