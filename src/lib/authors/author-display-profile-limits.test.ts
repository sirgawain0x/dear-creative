import { describe, expect, it } from "vitest";
import {
  AUTHOR_DISPLAY_NAME_MAX_LENGTH,
  AUTHOR_TAGLINE_MAX_LENGTH,
  validateAuthorDisplayName,
  validateAuthorTagline,
} from "./author-display-profile-limits";

describe("validateAuthorDisplayName", () => {
  it("trims and accepts names within the limit", () => {
    expect(validateAuthorDisplayName("  G2  ")).toEqual({
      ok: true,
      value: "G2",
    });
  });

  it("rejects empty names after trim", () => {
    expect(validateAuthorDisplayName("   ").ok).toBe(false);
  });

  it("rejects names over the max length", () => {
    const long = "a".repeat(AUTHOR_DISPLAY_NAME_MAX_LENGTH + 1);
    expect(validateAuthorDisplayName(long).ok).toBe(false);
  });
});

describe("validateAuthorTagline", () => {
  it("accepts taglines up to 120 characters", () => {
    const tagline = "x".repeat(AUTHOR_TAGLINE_MAX_LENGTH);
    expect(validateAuthorTagline(tagline)).toEqual({ ok: true, value: tagline });
  });

  it("rejects taglines over 120 characters", () => {
    const tagline = "x".repeat(AUTHOR_TAGLINE_MAX_LENGTH + 1);
    expect(validateAuthorTagline(tagline).ok).toBe(false);
  });

  it("maps blank taglines to null", () => {
    expect(validateAuthorTagline("   ")).toEqual({ ok: true, value: null });
  });
});
