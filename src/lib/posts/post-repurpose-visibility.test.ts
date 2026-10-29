import { describe, expect, it } from "vitest";
import { shouldRenderPostRepurposeSection } from "./post-repurpose-visibility";

describe("shouldRenderPostRepurposeSection", () => {
  it("hides repurpose companions when the paywall is shown", () => {
    expect(shouldRenderPostRepurposeSection(true)).toBe(false);
  });

  it("shows repurpose companions when the reader is entitled", () => {
    expect(shouldRenderPostRepurposeSection(false)).toBe(true);
  });
});
