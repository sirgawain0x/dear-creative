import type { DearCreativeDb } from "@/db/client";
import type { StudioAuthSuccess } from "@/lib/adam/studio-auth";
import { assertRepurposeCallerAccess } from "./access";
import { isRepurposeEnabled } from "./feature-flag";
import { generateTextRepurposeOutput, isTextRepurposeType } from "./generators/text";
import { loadRepurposePostSource, RepurposePostError } from "./post-source";
import {
  claimRepurposeGenerationLock,
  getRepurposeOutput,
  RepurposeStaleClaimError,
  saveRepurposeFailed,
  saveRepurposeReady,
} from "./storage";
import type { RepurposeOutputType, RepurposeStoredOutput } from "./types";

export class RepurposeGenerationError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly clientMessage: string,
    logDetail?: string,
  ) {
    super(logDetail ?? clientMessage);
    this.name = "RepurposeGenerationError";
  }
}

export type RunRepurposeGenerationDeps = {
  fetchFn?: typeof fetch;
};

export async function runRepurposeGeneration(input: {
  db: DearCreativeDb;
  postIdOrSlug: string;
  outputType: RepurposeOutputType;
  auth: StudioAuthSuccess;
  deps?: RunRepurposeGenerationDeps;
}): Promise<RepurposeStoredOutput> {
  if (!isRepurposeEnabled()) {
    throw new RepurposeGenerationError(503, "Repurpose is not enabled.");
  }

  let source;
  try {
    source = await loadRepurposePostSource(input.db, input.postIdOrSlug);
    await assertRepurposeCallerAccess({
      db: input.db,
      postAuthorId: source.authorId,
      postStatus: source.status,
      auth: input.auth,
    });
  } catch (error) {
    if (error instanceof RepurposePostError) {
      throw new RepurposeGenerationError(
        error.code === "not_found" ? 404 : 403,
        error.message,
      );
    }
    throw error;
  }

  const claim = await claimRepurposeGenerationLock({
    db: input.db,
    postId: source.id,
    outputType: input.outputType,
  });

  if (claim.outcome === "ready") {
    return claim.output;
  }
  if (claim.outcome === "conflict") {
    throw new RepurposeGenerationError(
      409,
      "A generation for this output type is already in progress.",
    );
  }

  const activeClaim =
    claim.outcome === "claimed"
      ? { rowId: claim.rowId, claimToken: claim.claimToken }
      : null;
  try {
    if (!isTextRepurposeType(input.outputType)) {
      throw new RepurposeGenerationError(
        501,
        `${input.outputType} generation is not available in this release.`,
      );
    }

    const generated = await generateTextRepurposeOutput({
      outputType: input.outputType,
      source,
      fetchFn: input.deps?.fetchFn,
    });

    if (!activeClaim) {
      throw new RepurposeGenerationError(
        409,
        "A generation for this output type is already in progress.",
      );
    }

    return await saveRepurposeReady({
      db: input.db,
      rowId: activeClaim.rowId,
      claimToken: activeClaim.claimToken,
      postId: source.id,
      outputType: input.outputType,
      payload: generated.payload,
      mediaUrl: generated.mediaUrl,
      mediaMimeType: generated.mediaMimeType,
    });
  } catch (error) {
    const logDetail =
      error instanceof Error ? error.message : "Repurpose generation failed";
    console.error("[repurpose] generation failed", {
      postId: source.id,
      outputType: input.outputType,
      detail: logDetail,
    });
    if (activeClaim) {
      await saveRepurposeFailed({
        db: input.db,
        rowId: activeClaim.rowId,
        claimToken: activeClaim.claimToken,
        postId: source.id,
        outputType: input.outputType,
        errorMessage: logDetail,
      });
    }
    if (error instanceof RepurposeStaleClaimError) {
      throw new RepurposeGenerationError(
        409,
        "A generation for this output type is already in progress.",
        logDetail,
      );
    }
    if (error instanceof RepurposePostError) {
      throw new RepurposeGenerationError(
        error.code === "not_found" ? 404 : 403,
        error.message,
        logDetail,
      );
    }
    if (error instanceof RepurposeGenerationError) {
      throw error;
    }
    throw new RepurposeGenerationError(
      500,
      "Repurpose generation failed.",
      logDetail,
    );
  }
}

/** @internal test helper */
export async function getRepurposeOutputForPost(
  db: DearCreativeDb,
  postId: string,
  outputType: RepurposeOutputType,
): Promise<RepurposeStoredOutput | null> {
  return getRepurposeOutput(db, postId, outputType);
}
