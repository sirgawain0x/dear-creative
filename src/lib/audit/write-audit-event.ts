import { randomUUID } from "node:crypto";
import type { DearCreativeDbSession } from "@/db/client";
import { auditEvents } from "@/db/schema";

export async function writeAuditEvent(
  db: Pick<DearCreativeDbSession, "insert">,
  input: {
    actor: string;
    action: string;
    entityType?: string;
    entityId?: string;
    payload?: unknown;
  },
): Promise<void> {
  await db.insert(auditEvents).values({
    id: randomUUID(),
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payloadJson:
      input.payload === undefined ? null : JSON.stringify(input.payload),
  });
}
