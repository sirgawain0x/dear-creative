import { eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { subscriptions } from "@/db/schema";
import type { StudioAuthSuccess } from "@/lib/adam/studio-auth";
import { RepurposePostError } from "./post-source";

export async function assertRepurposeCallerAccess(input: {
  db: DearCreativeDb;
  postAuthorId: string | null;
  postStatus: "draft" | "published";
  auth: StudioAuthSuccess;
}): Promise<void> {
  if (input.postStatus === "published") {
    return;
  }
  if (input.auth.mode === "adam_token") {
    return;
  }

  const authorId = input.postAuthorId?.trim();
  if (!authorId) {
    throw new RepurposePostError(
      "ineligible",
      "Draft post has no author; repurpose is limited to the owning writer.",
    );
  }

  const writerRows = await input.db
    .select({ writerId: subscriptions.writerId })
    .from(subscriptions)
    .where(eq(subscriptions.privyUserId, input.auth.actor));

  const writerIds = new Set(writerRows.map((row) => row.writerId));
  if (!writerIds.has(authorId)) {
    throw new RepurposePostError(
      "ineligible",
      "You can only repurpose draft posts you own as a writer.",
    );
  }
}
