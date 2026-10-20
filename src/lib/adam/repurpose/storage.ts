import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { ensurePostsSchema } from "@/db/ensure-schema";
import {
  postRepurposeOutputs,
  type PostRepurposeOutputStatus,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

export async function markRepurposeGenerating(
  db: DearCreativeDb,
  postId: string,
  outputType: RepurposeOutputType,
): Promise<RepurposeStoredOutput> {
  await ensurePostsSchema(db);
  const existing = await getRepurposeOutput(db, postId, outputType);
  const now = new Date();
  if (existing?.status === "ready") {
    return existing;
  }
  if (existing) {
    await db
      .update(postRepurposeOutputs)
      .set({
        status: "generating" satisfies PostRepurposeOutputStatus,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(postRepurposeOutputs.id, existing.id));
    const updated = await getRepurposeOutput(db, postId, outputType);
    if (!updated) {
      throw new Error("Failed to update repurpose output row");
    }
    return updated;
  }

  const id = randomUUID();
  await db.insert(postRepurposeOutputs).values({
    id,
    postId,
    outputType,
    status: "generating",
    payloadJson: null,
    mediaUrl: null,
    mediaMimeType: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getRepurposeOutput(db, postId, outputType);
  if (!created) {
    throw new Error("Failed to create repurpose output row");
  }
  return created;
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

/** Ensures repurpose table exists even before formal migration is applied in prod. */
export async function ensureRepurposeTable(db: DearCreativeDb): Promise<void> {
  await ensurePostsSchema(db);
  await db.run(sql.raw(`CREATE TABLE IF NOT EXISTS post_repurpose_outputs (
    id text PRIMARY KEY NOT NULL,
    post_id text NOT NULL,
    output_type text NOT NULL,
    status text NOT NULL,
    payload_json text,
    media_url text,
    media_mime_type text,
    error_message text,
    created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
    updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
  )`));
  await db.run(sql.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS post_repurpose_outputs_post_type_unique ON post_repurpose_outputs (post_id, output_type)`,
  ));
}
