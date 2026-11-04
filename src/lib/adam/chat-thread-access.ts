import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import { adamChatThreads, type AdamChatThreadRecord } from "@/db/schema";
import type { StudioAuthSuccess } from "@/lib/adam/studio-auth";

export type ChatThreadAccess = Pick<StudioAuthSuccess, "actor" | "mode">;

/** Legacy rows with NULL owner remain visible to all studio admins. */
export function canAccessChatThread(
  thread: Pick<AdamChatThreadRecord, "ownerUserId">,
  access: ChatThreadAccess,
): boolean {
  if (access.mode === "adam_token") {
    return true;
  }
  const owner = thread.ownerUserId?.trim();
  if (!owner) {
    return true;
  }
  return owner === access.actor;
}

export function studioChatThreadVisibilityCondition(
  access: ChatThreadAccess,
): SQL | undefined {
  if (access.mode === "adam_token") {
    return undefined;
  }
  return or(
    eq(adamChatThreads.ownerUserId, access.actor),
    isNull(adamChatThreads.ownerUserId),
  );
}

export function ownedThreadWhere(
  threadId: string,
  access: ChatThreadAccess,
): SQL {
  const visibility = studioChatThreadVisibilityCondition(access);
  if (visibility) {
    return and(eq(adamChatThreads.id, threadId), visibility)!;
  }
  return eq(adamChatThreads.id, threadId);
}
