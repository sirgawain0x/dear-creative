import { describe, expect, it } from "vitest";
import {
  MAX_AUTHOR_AVATAR_BYTES,
  MAX_PROFILE_IMAGE_BYTES,
  validateAuthorAvatarUpload,
  validateProfileImageUpload,
} from "./image-upload-validation";

describe("validateProfileImageUpload", () => {
  it("rejects unsupported mime types", () => {
    const file = new Blob(["x"], { type: "application/pdf" });
    const result = validateProfileImageUpload(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects files over the size limit", () => {
    const file = new Blob([new Uint8Array(MAX_PROFILE_IMAGE_BYTES + 1)], {
      type: "image/png",
    });
    const result = validateProfileImageUpload(file);
    expect(result.ok).toBe(false);
  });

  it("accepts allowed image types within size limit", () => {
    const file = new Blob(["png"], { type: "image/png" });
    expect(validateProfileImageUpload(file)).toEqual({ ok: true });
  });
});

describe("validateAuthorAvatarUpload", () => {
  it("accepts image/* types up to 2MB", () => {
    const file = new Blob(["png"], { type: "image/png" });
    expect(validateAuthorAvatarUpload(file)).toEqual({ ok: true });
  });

  it("rejects non-image types", () => {
    const file = new Blob(["x"], { type: "application/pdf" });
    expect(validateAuthorAvatarUpload(file).ok).toBe(false);
  });

  it("rejects files over 2MB", () => {
    const file = new Blob([new Uint8Array(MAX_AUTHOR_AVATAR_BYTES + 1)], {
      type: "image/jpeg",
    });
    expect(validateAuthorAvatarUpload(file).ok).toBe(false);
  });
});
