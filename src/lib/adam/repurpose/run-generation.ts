import type { DearCreativeDb } from "@/db/client";
import { synthesizeSpeechWithGoogle } from "@/lib/adam/gemini-studio";
import { uploadToLensGrove } from "@/lib/storage/lens-grove";
import type { FfmpegRunner } from "./ffmpeg";
import { isRepurposeEnabled } from "./feature-flag";
import {
  generateMediaRepurposeOutput,
  isMediaRepurposeType,
} from "./generators/media";
import { generateTextRepurposeOutput, isTextRepurposeType } from "./generators/text";
import {
  tryAcquireRepurposeLock,
  releaseRepurposeLock,
} from "./locks";
import { loadRepurposePostSource, RepurposePostError } from "./post-source";
import {
  ensureRepurposeTable,
  getRepurposeOutput,
  markRepurposeGenerating,
  saveRepurposeFailed,
  saveRepurposeReady,
} from "./storage";
import type { RepurposeOutputType, RepurposeStoredOutput } from "./types";

export class RepurposeGenerationError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "RepurposeGenerationError";
  }
}

export type RunRepurposeGenerationDeps = {
  fetchFn?: typeof fetch;
  synthesizeFn?: typeof synthesizeSpeechWithGoogle;
  ffmpeg?: FfmpegRunner;
  uploadFn?: typeof uploadToLensGrove;
};

export async function runRepurposeGeneration(input: {
  db: DearCreativeDb;
  postIdOrSlug: string;
  outputType: RepurposeOutputType;
  deps?: RunRepurposeGenerationDeps;
}): Promise<RepurposeStoredOutput> {
  if (!isRepurposeEnabled()) {
    throw new RepurposeGenerationError(503, "Repurpose is not enabled.");
  }

  await ensureRepurposeTable(input.db);
  const source = await loadRepurposePostSource(input.db, input.postIdOrSlug);

  const existing = await getRepurposeOutput(input.db, source.id, input.outputType);
  if (existing?.status === "ready") {
    return existing;
  }
  if (existing?.status === "generating") {
    throw new RepurposeGenerationError(
      409,
      "A generation for this output type is already in progress.",
    );
  }

  if (!tryAcquireRepurposeLock(source.id, input.outputType)) {
    throw new RepurposeGenerationError(
      409,
      "A generation for this output type is already in progress.",
    );
  }

  try {
    await markRepurposeGenerating(input.db, source.id, input.outputType);

    const generated = isTextRepurposeType(input.outputType)
      ? await generateTextRepurposeOutput({
          outputType: input.outputType,
          source,
          fetchFn: input.deps?.fetchFn,
        })
      : isMediaRepurposeType(input.outputType)
        ? await generateMediaRepurposeOutput({
            outputType: input.outputType,
            source,
            fetchFn: input.deps?.fetchFn,
            synthesizeFn: input.deps?.synthesizeFn,
            ffmpeg: input.deps?.ffmpeg,
            uploadFn: input.deps?.uploadFn,
          })
        : (() => {
            throw new RepurposeGenerationError(
              400,
              `Unsupported repurpose output type: ${input.outputType}`,
            );
          })();

    return await saveRepurposeReady({
      db: input.db,
      postId: source.id,
      outputType: input.outputType,
      payload: generated.payload,
      mediaUrl: generated.mediaUrl,
      mediaMimeType: generated.mediaMimeType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Repurpose generation failed";
    if (!(error instanceof RepurposeGenerationError)) {
      await saveRepurposeFailed({
        db: input.db,
        postId: source.id,
        outputType: input.outputType,
        errorMessage: message,
      });
    }
    if (error instanceof RepurposePostError) {
      throw new RepurposeGenerationError(
        error.code === "not_found" ? 404 : 400,
        error.message,
      );
    }
    if (error instanceof RepurposeGenerationError) {
      throw error;
    }
    throw new RepurposeGenerationError(500, message);
  } finally {
    releaseRepurposeLock(source.id, input.outputType);
  }
}
