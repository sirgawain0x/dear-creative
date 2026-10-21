import { describe, expect, it } from "vitest";
import { earnAuditLog } from "@/db/schema";

describe("earn_audit_log schema", () => {
  it("defines columns for future deposit/withdraw audit writes", () => {
    expect(earnAuditLog.adminPrivyUserId.name).toBe("admin_privy_user_id");
    expect(earnAuditLog.adminWalletId.name).toBe("admin_wallet_id");
    expect(earnAuditLog.action.name).toBe("action");
    expect(earnAuditLog.vaultId.name).toBe("vault_id");
    expect(earnAuditLog.asset.name).toBe("asset");
    expect(earnAuditLog.amount.name).toBe("amount");
    expect(earnAuditLog.txHash.name).toBe("tx_hash");
    expect(earnAuditLog.status.name).toBe("status");
    expect(earnAuditLog.createdAt.name).toBe("created_at");
  });
});
