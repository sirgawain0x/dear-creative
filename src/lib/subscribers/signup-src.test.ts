import { describe, expect, it } from "vitest";
import { sanitizeSignupSrc, SIGNUP_SRC_MAX_LENGTH } from "./signup-src";

describe("sanitizeSignupSrc", () => {
  it("lowercases and keeps [a-z0-9-]", () => {
    expect(sanitizeSignupSrc("CTV")).toBe("ctv");
    expect(sanitizeSignupSrc("yt")).toBe("yt");
    expect(sanitizeSignupSrc("Hash-Node_12")).toBe("hash-node12");
  });

  it("truncates to 32 characters", () => {
    const long = "a".repeat(40);
    expect(sanitizeSignupSrc(long)?.length).toBe(SIGNUP_SRC_MAX_LENGTH);
  });

  it("drops invalid values", () => {
    expect(sanitizeSignupSrc("")).toBeNull();
    expect(sanitizeSignupSrc("   ")).toBeNull();
    expect(sanitizeSignupSrc("!!!")).toBeNull();
    expect(sanitizeSignupSrc(undefined)).toBeNull();
    expect(sanitizeSignupSrc(null)).toBeNull();
  });
});
