/** Stale generating rows older than this may be reclaimed (must exceed route maxDuration). */
export const REPURPOSE_GENERATING_TTL_MS = 400_000;

/** Gemini structured JSON fetch timeout. */
export const REPURPOSE_GEMINI_FETCH_TIMEOUT_MS = 120_000;

/** Max decoded infographic image size before upload. */
export const REPURPOSE_MAX_INFOGRAPHIC_BYTES = 15 * 1024 * 1024;

/** ffmpeg execFile timeout (must stay below route maxDuration). */
export const REPURPOSE_FFMPEG_EXEC_TIMEOUT_MS = 240_000;
