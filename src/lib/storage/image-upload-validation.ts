export const ALLOWED_PROFILE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/** Matches admin banner upload limits for profile avatars. */
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageUploadValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function validateProfileImageUpload(file: Blob): ImageUploadValidationResult {
  if (file.type && !ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported file type: ${file.type}. Allowed: PNG, JPEG, WebP, GIF, SVG`,
    };
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    return {
      ok: false,
      status: 400,
      error: `Image exceeds maximum size of ${MAX_PROFILE_IMAGE_BYTES} bytes`,
    };
  }
  return { ok: true };
}
