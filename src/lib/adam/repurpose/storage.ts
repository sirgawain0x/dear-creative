import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { ensurePostsSchema } from "@/db/ensure-schema";
import { postRepurposeOutputs } from "@/db/schema";
import { isSqliteUniqueConstraintError } from "@/lib/db/sqlite-errors";
import { REPURPOSE_GENERATING_TTL_MS } from "./constants";
import type {
  RepurposeOutputStatus,
  RepurposeOutputType,
  RepurposeStoredOutput,
} from "./types";

function rowToStored(row: typeof postRepurposeOutputs.$inferSelect): RepurposeStoredOutput {
  let payload: unknown = null;
  if (row.payloadJson) {
    try {
      payload = JSON.parse(row.payloadJson) as unknown;
    } catch {
      payload = null;
    }
  }
  return {
    id: row.id,
    postId: row.postId,
    outputType: row.outputType as RepurposeOutputType,
    status: row.status as RepurposeOutputStatus,
    payload,
    mediaUrl: row.mediaUrl ?? null,
    mediaMimeType: row.mediaMimeType ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Strips internal failure details from API responses. */
export function toClientRepurposeOutput(
  output: RepurposeStoredOutput,
): RepurposeStoredOutput {
  if (output.status !== "failed") {
    return output;
  }
  return {
    ...output,
    errorMessage: "Generation failed.",
  };
}

export async function listRepurposeOutputsForPost(
  db: DearCreativeDb,
  postId: string,
): Promise<RepurposeStoredOutput[]> {
  await ensurePostsSchema(db);
  const rows = await db
    .select()
    .from(postRepurposeOutputs)
    .where(eq(postRepurposeOutputs.postId, postId));
  return rows.map(rowToStored);
}

export async function getRepurposeOutput(
  db: DearCreativeDb,
  postId: string,
  outputType: RepurposeOutputType,
): Promise<RepurposeStoredOutput | null> {
  await ensurePostsSchema(db);
  const rows = await db
    .select()
    .from(postRepurposeOutputs)
    .where(
      and(
        eq(postRepurposeOutputs.postId, postId),
        eq(postRepurposeOutputs.outputType, outputType),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? rowToStored(row) : null;
}

export type ClaimRepurposeLockResult =
  | { outcome: "ready"; output: RepurposeStoredOutput }
  | { outcome: "claimed"; rowId: string; claimToken: string }
  | { outcome: "conflict" };

async function tryReclaimGeneratingLock(input: {
  db: DearCreativeDb;
  postId: string;
  outputType: RepurposeOutputType;
  nowMs: number;
  staleBeforeMs: number;
  claimToken: string;
}): Promise<string | null> {
  const reclaimed = await input.db.all<{ id: string }>(sql`
    UPDATE post_repurpose_outputs
    SET status = 'generating',
        error_message = NULL,
        updated_at = ${input.nowMs},
        claim_token = ${input.claimToken}
    WHERE post_id = ${input.postId}
      AND output_type = ${input.outputType}
      AND (
        status = 'failed'
        OR (status = 'generating' AND updated_at < ${input.staleBeforeMs})
      )
    RETURNING id
  `);
  return reclaimed[0]?.id ?? null;
}

export async function claimRepurposeGenerationLock(input: {
  db: DearCreativeDb;
  postId: string;
  outputType: RepurposeOutputType;
  now?: Date;
}): Promise<ClaimRepurposeLockResult> {
  await ensurePostsSchema(input.db);
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const staleBeforeMs = nowMs - REPURPOSE_GENERATING_TTL_MS;

  const existing = await getRepurposeOutput(input.db, input.postId, input.outputType);
  if (existing?.status === "ready") {
    return { outcome: "ready", output: existing };
  }

  const claimToken = randomUUID();

  if (existing) {
    const reclaimedId = await tryReclaimGeneratingLock({
      db: input.db,
      postId: input.postId,
      outputType: input.outputType,
      nowMs,
      staleBeforeMs,
      claimToken,
    });
    if (reclaimedId) {
      return { outcome: "claimed", rowId: reclaimedId, claimToken };
    }
    return { outcome: "conflict" };
  }

  const id = randomUUID();
  try {
    await input.db.insert(postRepurposeOutputs).values({
      id,
      postId: input.postId,
      outputType: input.outputType,
      status: "generating",
      payloadJson: null,
      mediaUrl: null,
      mediaMimeType: null,
      errorMessage: null,
      claimToken,
      createdAt: now,
      updatedAt: now,
    });
    return { outcome: "claimed", rowId: id, claimToken };
  } catch (error) {
    if (!isSqliteUniqueConstraintError(error)) {
      throw error;
    }
    const racedExisting = await getRepurposeOutput(
      input.db,
      input.postId,
      input.outputType,
    );
    if (racedExisting?.status === "ready") {
      return { outcome: "ready", output: racedExisting };
    }
    const racedClaimToken = randomUUID();
    const reclaimedId = await tryReclaimGeneratingLock({
      db: input.db,
      postId: input.postId,
      outputType: input.outputType,
      nowMs,
      staleBeforeMs,
      claimToken: racedClaimToken,
    });
    if (reclaimedId) {
      return { outcome: "claimed", rowId: reclaimedId, claimToken: racedClaimToken };
    }
    return { outcome: "conflict" };
  }
}

export class RepurposeStaleClaimError extends Error {
  constructor() {
    super("Repurpose claim is no longer active");
    this.name = "RepurposeStaleClaimError";
  }
}

export async function saveRepurposeReady(input: {
  db: DearCreativeDb;
  rowId: string;
  claimToken: string;
  postId: string;
  outputType: RepurposeOutputType;
  payload: unknown;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
}): Promise<RepurposeStoredOutput> {
  const now = new Date();
  const updated = await input.db
    .update(postRepurposeOutputs)
    .set({
      status: "ready",
      payloadJson: JSON.stringify(input.payload),
      mediaUrl: input.mediaUrl ?? null,
      mediaMimeType: input.mediaMimeType ?? null,
      errorMessage: null,
      claimToken: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(postRepurposeOutputs.id, input.rowId),
        eq(postRepurposeOutputs.postId, input.postId),
        eq(postRepurposeOutputs.outputType, input.outputType),
        eq(postRepurposeOutputs.status, "generating"),
        eq(postRepurposeOutputs.claimToken, input.claimToken),
      ),
    )
    .returning();

  if (!updated[0]) {
    throw new RepurposeStaleClaimError();
  }
  return rowToStored(updated[0]);
}

export async function saveRepurposeFailed(input: {
  db: DearCreativeDb;
  rowId: string;
  claimToken: string;
  postId: string;
  outputType: RepurposeOutputType;
  errorMessage: string;
}): Promise<void> {
  const now = new Date();
  await input.db
    .update(postRepurposeOutputs)
    .set({
      status: "failed",
      errorMessage: input.errorMessage.slice(0, 2000),
      claimToken: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(postRepurposeOutputs.id, input.rowId),
        eq(postRepurposeOutputs.postId, input.postId),
        eq(postRepurposeOutputs.outputType, input.outputType),
        eq(postRepurposeOutputs.status, "generating"),
        eq(postRepurposeOutputs.claimToken, input.claimToken),
      ),
    );
}
