import { getAddress, type Address } from "viem";
import { resolveAdminWalletConfig } from "./admin-wallet-address";
import { alchemyWalletJsonRpc } from "./alchemy-wallet-jsonrpc";
import {
  assertSwapCallTargetsAllowlisted,
  collectSwapCallTargets,
} from "./swap-allowlist";
import { WALLET_SWAP_ALLOWLIST_ERROR, WALLET_SWAP_QUOTE_EXPIRED_ERROR } from "./swap-errors";
import { isQuoteNearOrPastExpiry } from "./swap-expiry";

export type SwapSubmitInput = {
  prepared: Record<string, unknown>;
  signature: `0x${string}`;
  chainId?: number;
};

export async function submitAdminSwapPreparedCall(
  input: SwapSubmitInput,
): Promise<
  | { ok: true; callId: string }
  | { ok: false; status: number; error: string }
> {
  const config = resolveAdminWalletConfig();
  if (!config.configured) {
    return { ok: false, status: 400, error: "Admin wallet is not configured." };
  }

  const targets = collectSwapCallTargets(input.prepared);
  const allow = assertSwapCallTargetsAllowlisted(targets, config.address);
  if (!allow.ok) {
    return { ok: false, status: 502, error: WALLET_SWAP_ALLOWLIST_ERROR };
  }

  const quote = input.prepared.quote as { expiry?: string } | undefined;
  if (quote?.expiry && isQuoteNearOrPastExpiry(quote.expiry)) {
    return { ok: false, status: 409, error: WALLET_SWAP_QUOTE_EXPIRED_ERROR };
  }

  const chainId = input.chainId ?? 8453;
  const chainIdHex = `0x${chainId.toString(16)}`;

  const param = {
    ...input.prepared,
    chainId: chainIdHex,
    signature: {
      type: "secp256k1",
      data: input.signature,
    },
  };

  const result = await alchemyWalletJsonRpc<{ id: string }>("wallet_sendPreparedCalls", [
    param,
  ]);

  if (!result?.id) {
    return {
      ok: false,
      status: 502,
      error: "Unable to process wallet swap. Try again later.",
    };
  }

  return { ok: true, callId: result.id };
}

export async function fetchAdminSwapCallStatus(callId: string): Promise<{
  status: number;
  receipts?: Array<{ transactionHash?: string }>;
}> {
  const result = await alchemyWalletJsonRpc<{
    status: number;
    receipts?: Array<{ transactionHash?: string }>;
  }>("wallet_getCallsStatus", [[callId]]);

  return {
    status: result.status,
    receipts: result.receipts,
  };
}

export function assertPreparedFromAdmin(
  prepared: Record<string, unknown>,
  admin: Address,
): boolean {
  const from = prepared.from;
  if (typeof from === "string") {
    try {
      return getAddress(from).toLowerCase() === admin.toLowerCase();
    } catch {
      return false;
    }
  }
  return true;
}
