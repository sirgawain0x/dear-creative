import type { Address, Hex } from "viem";
import {
  buildAdminWalletSendCalls,
  type AdminWalletSendAsset,
  type AdminWalletSendValidationSuccess,
} from "./send-validation";

export type ExecuteAdminWalletSendInput = {
  fromAddress: Address;
  validated: AdminWalletSendValidationSuccess;
};

export type ExecuteAdminWalletSendResult =
  | { mode: "submitted"; txHash: Hex }
  | {
      mode: "client";
      calls: Array<{ to: Address; value: string; data: Hex }>;
    };

let executeAdminWalletSendOverride:
  | ((input: ExecuteAdminWalletSendInput) => Promise<ExecuteAdminWalletSendResult>)
  | null
  | undefined;

export function setExecuteAdminWalletSendForTests(
  fn:
    | ((input: ExecuteAdminWalletSendInput) => Promise<ExecuteAdminWalletSendResult>)
    | null,
): void {
  executeAdminWalletSendOverride = fn;
}

export function resetExecuteAdminWalletSendForTests(): void {
  executeAdminWalletSendOverride = undefined;
}

/** Privy + Alchemy smart-wallet send is executed on the client; server returns call bundle. */
export async function executeAdminWalletSend(
  input: ExecuteAdminWalletSendInput,
): Promise<ExecuteAdminWalletSendResult> {
  if (executeAdminWalletSendOverride !== undefined && executeAdminWalletSendOverride !== null) {
    return executeAdminWalletSendOverride(input);
  }

  const calls = buildAdminWalletSendCalls(input.validated).map((call) => ({
    to: call.to,
    value: call.value.toString(),
    data: call.data,
  }));

  return { mode: "client", calls };
}

export function parseAdminWalletSendAsset(raw: unknown): AdminWalletSendAsset | null {
  if (raw === "USDC" || raw === "ETH") {
    return raw;
  }
  return null;
}
