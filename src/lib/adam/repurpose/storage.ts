import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { ensurePostsSchema } from "@/db/ensure-schema";
import { postRepurposeOutputs } from "@/db/schema";
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
  | { outcome: "claimed"; rowId: string }
  | { outcome: "conflict" };

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

  if (existing) {
    const reclaimed = await input.db.all<{ id: string }>(sql`
      UPDATE post_repurpose_outputs
      SET status = 'generating', error_message = NULL, updated_at = ${nowMs}
      WHERE post_id = ${input.postId}
        AND output_type = ${input.outputType}
        AND (
          status = 'failed'
          OR (status = 'generating' AND updated_at < ${staleBeforeMs})
        )
      RETURNING id
    `);
    if (reclaimed[0]?.id) {
      return { outcome: "claimed", rowId: reclaimed[0].id };
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
      createdAt: now,
      updatedAt: now,
    });
    return { outcome: "claimed", rowId: id };
  } catch {
    const racedExisting = await getRepurposeOutput(
      input.db,
      input.postId,
      input.outputType,
    );
    if (racedExisting?.status === "ready") {
      return { outcome: "ready", output: racedExisting };
    }
    const reclaimed = await input.db.all<{ id: string }>(sql`
      UPDATE post_repurpose_outputs
      SET status = 'generating', error_message = NULL, updated_at = ${nowMs}
      WHERE post_id = ${input.postId}
        AND output_type = ${input.outputType}
        AND (
          status = 'failed'
          OR (status = 'generating' AND updated_at < ${staleBeforeMs})
        )
      RETURNING id
    `);
    if (reclaimed[0]?.id) {
      return { outcome: "claimed", rowId: reclaimed[0].id };
    }
    return { outcome: "conflict" };
  }
}

export async function saveRepurposeReady(input: {
  db: DearCreativeDb;
  postId: string;
  outputType: RepurposeOutputType;
  payload: unknown;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
}): Promise<RepurposeStoredOutput> {
  const now = new Date();
  await input.db
    .update(postRepurposeOutputs)
    .set({
      status: "ready",
      payloadJson: JSON.stringify(input.payload),
      mediaUrl: input.mediaUrl ?? null,
      mediaMimeType: input.mediaMimeType ?? null,
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(postRepurposeOutputs.postId, input.postId),
        eq(postRepurposeOutputs.outputType, input.outputType),
      ),
    );
  const row = await getRepurposeOutput(input.db, input.postId, input.outputType);
  if (!row) {
    throw new Error("Repurpose output row missing after save");
  }
  return row;
}

export async function saveRepurposeFailed(input: {
  db: DearCreativeDb;
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
      updatedAt: now,
    })
    .where(
      and(
        eq(postRepurposeOutputs.postId, input.postId),
        eq(postRepurposeOutputs.outputType, input.outputType),
      ),
    );
}
