import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { writerGroupSplits } from "@/db/schema";
import { isCowritersEnabled } from "./feature-flag";
import { computeWriterGroupKey } from "./group-key";
import {
  listActivePostWriters,
  postUsesCowriterFlow,
  resolveWriterPayoutInfos,
} from "./membership";

export type PublishGateCheck = {
  id: string;
  label: string;
  ok: boolean;
};

export type PublishGateEvaluation = {
  applies: boolean;
  blocked: boolean;
  checks: PublishGateCheck[];
};

export class CowriterPublishBlockedError extends Error {
  readonly checks: PublishGateCheck[];

  constructor(checks: PublishGateCheck[]) {
    super("Publish blocked by co-writer readiness checks");
    this.name = "CowriterPublishBlockedError";
    this.checks = checks;
  }
}

export async function evaluateCowriterPublishGate(
  db: DearCreativeDb,
  postId: string,
): Promise<PublishGateEvaluation> {
  if (!isCowritersEnabled()) {
    return { applies: false, blocked: false, checks: [] };
  }

  const usesCowriters = await postUsesCowriterFlow(db, postId);
  if (!usesCowriters) {
    return { applies: false, blocked: false, checks: [] };
  }

  const activeRows = await listActivePostWriters(db, postId);
  const payoutInfos = await resolveWriterPayoutInfos(db, postId);
  const checks: PublishGateCheck[] = [];

  const pendingCowriters = activeRows.filter(
    (row) => row.role === "cowriter" && row.status === "pending",
  );
  checks.push({
    id: "cowriter-accepted",
    label: "All co-writer invites accepted",
    ok: pendingCowriters.length === 0,
  });

  for (const info of payoutInfos) {
    const hasWallet = Boolean(info.payoutWallet?.trim());
    checks.push({
      id: `payout-${info.postWriterId}`,
      label: `${info.role === "author" ? "Author" : "Co-writer"} (${info.displayLabel}) has a payout wallet`,
      ok: hasWallet,
    });
  }

  const walletReady = payoutInfos.filter((info) => info.payoutWallet?.trim());
  if (walletReady.length >= 2) {
    const pairs = walletReady.map((info) => ({
      wallet: info.payoutWallet!.trim(),
      shareBps: info.shareBps,
    }));
    const groupKey = computeWriterGroupKey(pairs);
    const [splitRow] = await db
      .select()
      .from(writerGroupSplits)
      .where(
        and(
          eq(writerGroupSplits.groupKey, groupKey),
          eq(writerGroupSplits.status, "deployed"),
        ),
      )
      .limit(1);

    const splitReady = Boolean(splitRow?.splitAddress?.trim());
    checks.push({
      id: "writer-group-split",
      label: "Writer group split is deployed for this share group",
      ok: splitReady,
    });
  }

  const blocked = checks.some((check) => !check.ok);
  return { applies: true, blocked, checks };
}

export async function assertCowriterPublishAllowed(
  db: DearCreativeDb,
  postId: string,
): Promise<void> {
  const evaluation = await evaluateCowriterPublishGate(db, postId);
  if (evaluation.blocked) {
    throw new CowriterPublishBlockedError(evaluation.checks);
  }
}
