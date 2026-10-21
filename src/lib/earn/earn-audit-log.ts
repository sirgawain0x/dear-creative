import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { earnAuditLog } from "@/db/schema";
import type { EarnActionDirection } from "./validate-action";

export type InsertEarnAuditLogInput = {
  adminPrivyUserId: string;
  adminWalletId: string;
  action: EarnActionDirection;
  vaultId: string;
  asset: string;
  amount: string;
  status: string;
  txHash?: string | null;
  privyActionId?: string | null;
};

export async function insertEarnAuditLogRow(
  input: InsertEarnAuditLogInput,
): Promise<void> {
  const db = getDb();
  await db.insert(earnAuditLog).values({
    id: randomUUID(),
    adminPrivyUserId: input.adminPrivyUserId,
    adminWalletId: input.adminWalletId,
    action: input.action,
    vaultId: input.vaultId,
    asset: input.asset,
    amount: input.amount,
    status: input.status,
    txHash: input.txHash ?? input.privyActionId ?? null,
  });
}
