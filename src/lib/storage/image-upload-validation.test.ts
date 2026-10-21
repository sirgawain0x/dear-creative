import { describe, expect, it } from "vitest";
import {
  MAX_PROFILE_IMAGE_BYTES,
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
